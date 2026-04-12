// 事前準備（Embedding作成 / 典型例生成）のコア処理
// - Server Action/API Route から共通で呼べるように、adminToken を明示引数で受け取る
import 'server-only';

import type { Database } from '@/types/database';
import {
  deleteTypicalExamplesForBucket,
  fetchEmbeddingsForBucket,
  fetchPendingEmbeddingJobs,
  fetchResponsesForEmbeddingJobs,
  markEmbeddingJobs,
  insertResponseEmbeddings,
  upsertTypicalExamples,
} from '@/lib/supabase';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { embedText } from '@/lib/gemini';
import { toScoreBucket } from '@/lib/scoring';
import { kmeansCosine } from '@/lib/ml/kmeans';
import { cosineDistance, type Vector } from '@/lib/ml/vector';

export const EMBEDDING_MODEL = 'models/gemini-embedding-001';
export const EMBEDDING_DIM = 3072;

// 並行処理設定
const EMBEDDING_CONCURRENCY = 5;
const EMBEDDING_DELAY_MS = 0;
const MAX_RETRIES = 5;
const INITIAL_RETRY_DELAY_MS = 1000;

// 指数バックオフ付きリトライ
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = MAX_RETRIES,
  initialDelayMs: number = INITIAL_RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      const isRateLimit = lastError.message.includes('429') ||
                          lastError.message.toLowerCase().includes('rate') ||
                          lastError.message.toLowerCase().includes('quota');
      const isServerError = lastError.message.includes('502') ||
                            lastError.message.includes('503') ||
                            lastError.message.includes('504') ||
                            lastError.message.toLowerCase().includes('bad gateway') ||
                            lastError.message.toLowerCase().includes('service unavailable');

      if (attempt < maxRetries) {
        // 指数バックオフ（レート制限/サーバーエラー時は長めに待機）
        const delay = (isRateLimit || isServerError)
          ? initialDelayMs * Math.pow(3, attempt) // レート制限/502等: 1s, 3s, 9s, 27s, 81s
          : initialDelayMs * Math.pow(2, attempt); // 通常: 1s, 2s, 4s, 8s, 16s
        console.log(`[withRetry] attempt ${attempt + 1}/${maxRetries} failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

function parseVector(v: unknown): Vector {
  if (Array.isArray(v)) return v.map((x) => Number(x));
  if (typeof v === 'string') {
    // pgvector は "[1,2,3]" 形式で返ることがある
    const trimmed = v.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      const inner = trimmed.slice(1, -1).trim();
      if (!inner) return [];
      return inner.split(',').map((s) => Number(s.trim()));
    }
  }
  return [];
}

function buildOrFilter(pairs: { case_id: string; response_id: string }[]) {
  return pairs.map((p) => `and(case_id.eq.${p.case_id},response_id.eq.${p.response_id})`).join(',');
}

export async function processEmbeddingQueueBatchWithToken(
  adminToken: string,
  limit: number = 30
): Promise<{ processed: number; succeeded: number; failed: number }> {
  console.log(`[processEmbedding] === バッチ開始 (limit=${limit}) ===`);

  const jobs = await fetchPendingEmbeddingJobs(limit, adminToken);
  if (jobs.length === 0) {
    console.log('[processEmbedding] 処理待ちジョブなし');
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  console.log(`[processEmbedding] 取得ジョブ数: ${jobs.length}`);

  const nextAttempts = new Map<string, number>();
  for (const j of jobs) {
    nextAttempts.set(`${j.case_id}__${j.response_id}__${j.question}`, (j.attempts ?? 0) + 1);
  }

  console.log('[processEmbedding] ステータスを processing に更新中...');
  try {
    await markEmbeddingJobs(
      jobs.map((j) => ({
        case_id: j.case_id,
        response_id: j.response_id,
        question: j.question,
        status: 'processing' as const,
        attempts: nextAttempts.get(`${j.case_id}__${j.response_id}__${j.question}`) ?? (j.attempts ?? 0) + 1,
        last_error: null,
      })),
      adminToken
    );
    console.log('[processEmbedding] ステータス更新完了');
  } catch (e) {
    console.error('[processEmbedding] ステータス更新失敗:', e instanceof Error ? e.message : e);
    throw e;
  }

  console.log('[processEmbedding] 解答テキスト取得中...');
  const rows = await fetchResponsesForEmbeddingJobs(
    jobs.map((j) => ({ case_id: j.case_id, response_id: j.response_id, question: j.question })),
    adminToken
  );
  console.log(`[processEmbedding] 解答テキスト取得完了: ${rows.length}件`);

  const rowMap = new Map<string, (typeof rows)[number]>();
  for (const r of rows) rowMap.set(`${r.case_id}__${r.response_id}`, r);

  async function mapWithConcurrency<T, R>(
    items: T[],
    concurrency: number,
    fn: (item: T) => Promise<R>,
    delayMs: number = 0
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let cursor = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
      while (true) {
        const i = cursor;
        cursor += 1;
        if (i >= items.length) break;
        results[i] = await fn(items[i]);
        // レート制限対策: リクエスト間に遅延を入れる
        if (delayMs > 0 && i < items.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    });
    await Promise.all(workers);
    return results;
  }

  const toUpsert: Database['public']['Tables']['response_embeddings']['Insert'][] = [];
  const results: { key: string; ok: boolean; error?: string }[] = [];

  type JobResult =
    | { key: string; ok: true; row: Database['public']['Tables']['response_embeddings']['Insert'] }
    | { key: string; ok: false; error: string };

  const estMinutes = EMBEDDING_DELAY_MS > 0 ? Math.ceil((jobs.length * EMBEDDING_DELAY_MS) / 60000) : 1;
  console.log(`[processEmbedding] Embedding生成開始 (並列度=${EMBEDDING_CONCURRENCY}, 遅延=${EMBEDDING_DELAY_MS}ms, 推定${estMinutes}分)`);
  let completedCount = 0;
  const startTime = Date.now();

  const computed = await mapWithConcurrency(jobs, EMBEDDING_CONCURRENCY, async (job): Promise<JobResult> => {
    const key = `${job.case_id}__${job.response_id}`;
    const src = rowMap.get(key);
    // q1 → answer_q1, q2 → answer_q2〜q8を結合
    const text = job.question === 'q1'
      ? src?.answer_q1
      : [src?.answer_q2, src?.answer_q3, src?.answer_q4, src?.answer_q5, src?.answer_q6, src?.answer_q7, src?.answer_q8]
          .filter(Boolean)
          .join('\n');
    // スコアは score_problem / score_solution をそのまま使用（評価軸は変わらない）
    const score = job.question === 'q1' ? src?.score_problem : src?.score_solution;
    if (!src || !text || !text.trim()) {
      console.log(`[embedding] スキップ: ${key}/${job.question} - テキストなし (hasSrc=${!!src}, textLen=${text?.length ?? 0})`);
      completedCount++;
      return { key: `${key}__${job.question}`, ok: false, error: 'テキストが見つかりません' };
    }
    try {
      // 指数バックオフ付きリトライでAPIレート制限に対応
      const emb = await withRetry(() => embedText(text));
      if (emb.values.length !== EMBEDDING_DIM) {
        throw new Error(`embedding次元が想定外です: ${emb.values.length}`);
      }
      completedCount++;
      if (completedCount % 50 === 0) {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`[processEmbedding] 進捗: ${completedCount}/${jobs.length} 完了 (${elapsed}秒経過)`);
      }
      return {
        key: `${key}__${job.question}`,
        ok: true,
        row: {
          case_id: job.case_id,
          response_id: job.response_id,
          question: job.question,
          score: typeof score === 'number' ? score : score == null ? null : Number(score),
          score_bucket: toScoreBucket(typeof score === 'number' ? score : Number(score ?? 0)),
          embedding: emb.values,
          embedding_model: EMBEDDING_MODEL,
          embedding_dim: EMBEDDING_DIM,
        },
      };
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : 'embedding生成に失敗しました';
      console.error(`[embedding] 失敗: ${key}/${job.question} - ${errorMsg}`);
      completedCount++;
      return {
        key: `${key}__${job.question}`,
        ok: false,
        error: errorMsg,
      };
    }
  }, EMBEDDING_DELAY_MS);

  const totalElapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`[processEmbedding] Embedding生成完了 (${totalElapsed}秒)`);

  for (const r of computed) {
    if (r.ok) {
      toUpsert.push(r.row);
      results.push({ key: r.key, ok: true });
    } else {
      results.push({ key: r.key, ok: false, error: r.error });
    }
  }

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;

  // エラー詳細のサマリーを出力
  if (failed > 0) {
    const errorSummary = new Map<string, number>();
    for (const r of results) {
      if (!r.ok && r.error) {
        const shortError = r.error.length > 80 ? r.error.slice(0, 80) + '...' : r.error;
        errorSummary.set(shortError, (errorSummary.get(shortError) ?? 0) + 1);
      }
    }
    console.log(`[processEmbedding] エラー詳細 (${failed}件失敗):`);
    for (const [error, count] of errorSummary) {
      console.log(`  - ${error}: ${count}件`);
    }
  }

  if (toUpsert.length) {
    console.log(`[processEmbedding] Embedding保存中... (${toUpsert.length}件)`);
    try {
      await insertResponseEmbeddings(toUpsert, adminToken);
      console.log(`[processEmbedding] Embedding保存完了`);
    } catch (e) {
      console.error(`[processEmbedding] Embedding保存失敗:`, e instanceof Error ? e.message : e);
      throw e;
    }
  }

  console.log(`[processEmbedding] ジョブステータス更新中... (done=${succeeded}, error=${failed})`);
  try {
    await markEmbeddingJobs(
      jobs.map((j) => {
        const r = results.find((x) => x.key === `${j.case_id}__${j.response_id}__${j.question}`);
        return {
          case_id: j.case_id,
          response_id: j.response_id,
          question: j.question,
          status: r?.ok ? ('done' as const) : ('error' as const),
          attempts: nextAttempts.get(`${j.case_id}__${j.response_id}__${j.question}`) ?? (j.attempts ?? 0) + 1,
          last_error: r?.ok ? null : r?.error ?? 'unknown error',
        };
      }),
      adminToken
    );
    console.log(`[processEmbedding] ジョブステータス更新完了`);
  } catch (e) {
    console.error(`[processEmbedding] ジョブステータス更新失敗:`, e instanceof Error ? e.message : e);
    // ステータス更新失敗は無視して続行（次回リトライされる）
  }

  console.log(`[processEmbedding] === バッチ完了: ${succeeded}件成功 / ${failed}件失敗 ===`);
  return { processed: jobs.length, succeeded, failed };
}

export async function rebuildTypicalExamplesForBucketWithToken(params: {
  adminToken: string;
  caseId: string;
  question: 'q1' | 'q2';
  scoreBucket: number;
  maxClusters?: number;
}): Promise<{ clusters: number; points: number }> {
  const { adminToken, caseId, question, scoreBucket } = params;
  const maxClusters = Math.max(1, Math.min(params.maxClusters ?? 3, 6));

  const embeddings = await fetchEmbeddingsForBucket(caseId, question, scoreBucket, 5000, adminToken);
  const vectors = embeddings.map((e) => parseVector(e.embedding)).filter((v) => v.length === EMBEDDING_DIM);
  const n = vectors.length;
  if (n === 0) {
    await deleteTypicalExamplesForBucket(caseId, question, scoreBucket, adminToken);
    return { clusters: 0, points: 0 };
  }

  const k = Math.min(maxClusters, Math.max(1, Math.round(Math.sqrt(n / 10))));
  const clusters = kmeansCosine(vectors, k, 20);

  const reps: { idx: number; distance: number; clusterSize: number; centroid: Vector }[] = [];
  for (const c of clusters) {
    let bestIdx = c.indices[0];
    let bestDist = Number.POSITIVE_INFINITY;
    for (const i of c.indices) {
      const d = cosineDistance(vectors[i], c.centroid);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }
    reps.push({ idx: bestIdx, distance: bestDist, clusterSize: c.indices.length, centroid: c.centroid });
  }

  const repPairs = reps.map((r) => ({
    case_id: embeddings[r.idx].case_id,
    response_id: embeddings[r.idx].response_id,
  }));
  // RLS: responses の SELECT は authenticated なので認証必須
  const supabase = createAuthedAnonServerClient(adminToken);
  const or = buildOrFilter(repPairs);
  const { data, error } = await supabase
    .from('responses')
    .select('case_id,response_id,answer_q1,answer_q2,answer_q3,answer_q4,answer_q5,answer_q6,answer_q7,answer_q8,score_problem,score_solution')
    .or(or);
  if (error) {
    throw new Error(`代表解答の取得に失敗しました: ${error.message}`);
  }

  const textMap = new Map<
    string,
    {
      answer_q1: string | null;
      answer_q2_combined: string | null;
      score_problem: number | null;
      score_solution: number | null;
    }
  >();
  const list = (data ?? []) as unknown[];
  for (const item of list) {
    const r = item as {
      case_id: string;
      response_id: string;
      answer_q1?: string | null;
      answer_q2?: string | null;
      answer_q3?: string | null;
      answer_q4?: string | null;
      answer_q5?: string | null;
      answer_q6?: string | null;
      answer_q7?: string | null;
      answer_q8?: string | null;
      score_problem?: number | null;
      score_solution?: number | null;
    };
    if (!r.case_id || !r.response_id) continue;
    // q2 は answer_q2〜q8 を結合
    const q2Combined = [r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8]
      .filter(Boolean)
      .join('\n') || null;
    textMap.set(`${r.case_id}__${r.response_id}`, {
      answer_q1: r.answer_q1 ?? null,
      answer_q2_combined: q2Combined,
      score_problem: r.score_problem ?? null,
      score_solution: r.score_solution ?? null,
    });
  }

  await deleteTypicalExamplesForBucket(caseId, question, scoreBucket, adminToken);

  type TypicalExampleInsert = Database['public']['Tables']['typical_examples']['Insert'];
  const rows: TypicalExampleInsert[] = reps
    .map((r, clusterId) => {
      const embRow = embeddings[r.idx];
      const resp = textMap.get(`${embRow.case_id}__${embRow.response_id}`);
      // q1 → answer_q1, q2 → answer_q2〜q8結合版
      const repText = question === 'q1' ? resp?.answer_q1 : resp?.answer_q2_combined;
      const repScore = question === 'q1' ? resp?.score_problem : resp?.score_solution;
      if (!repText || !String(repText).trim()) return null;
      const row: TypicalExampleInsert = {
        case_id: caseId,
        question,
        score_bucket: scoreBucket,
        cluster_id: clusterId,
        cluster_size: r.clusterSize,
        centroid: r.centroid as unknown,
        rep_case_id: caseId,
        rep_response_id: embRow.response_id,
        rep_text: String(repText),
        rep_score: repScore == null ? null : Number(repScore),
        rep_distance: r.distance,
        embedding_model: EMBEDDING_MODEL,
        embedding_dim: EMBEDDING_DIM,
      };
      return row;
    })
    .filter((x): x is TypicalExampleInsert => x !== null);

  if (rows.length) {
    await upsertTypicalExamples(rows, adminToken);
  }

  return { clusters: rows.length, points: n };
}

// ============================================
// Service Role版（JWT期限切れの影響を受けない）
// バックグラウンドアップロード処理用
// ============================================

// エンベディング処理（Service Role版）
export async function processEmbeddingQueueBatchServiceRole(
  limit: number = 30
): Promise<{ processed: number; succeeded: number; failed: number }> {
  console.log(`[processEmbeddingServiceRole] === バッチ開始 (limit=${limit}) ===`);

  const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

  // pending状態のジョブを取得
  const { data: jobs, error: fetchError } = await supabaseServiceRole
    .from('embedding_queue')
    .select('case_id,response_id,question,attempts')
    .eq('status', 'pending')
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (fetchError) {
    console.error('fetchPendingEmbeddingJobs error:', fetchError);
    return { processed: 0, succeeded: 0, failed: 0 };
  }

  if (!jobs || jobs.length === 0) {
    console.log('[processEmbeddingServiceRole] 処理待ちジョブなし');
    return { processed: 0, succeeded: 0, failed: 0 };
  }
  console.log(`[processEmbeddingServiceRole] 取得ジョブ数: ${jobs.length}`);

  const nextAttempts = new Map<string, number>();
  for (const j of jobs) {
    nextAttempts.set(`${j.case_id}__${j.response_id}__${j.question}`, (j.attempts ?? 0) + 1);
  }

  // ステータスを processing に更新
  for (const j of jobs) {
    await supabaseServiceRole
      .from('embedding_queue')
      .update({ status: 'processing', updated_at: new Date().toISOString() })
      .eq('case_id', j.case_id)
      .eq('response_id', j.response_id)
      .eq('question', j.question);
  }

  // 解答データを取得
  type ResponseData = {
    case_id: string;
    response_id: string;
    answer_q1: string | null;
    answer_q2: string | null;
    answer_q3: string | null;
    answer_q4: string | null;
    answer_q5: string | null;
    answer_q6: string | null;
    answer_q7: string | null;
    answer_q8: string | null;
    score_problem: number | null;
    score_solution: number | null;
  };
  const orFilter = jobs.map((p) => `and(case_id.eq.${p.case_id},response_id.eq.${p.response_id})`).join(',');
  const { data: responses } = await supabaseServiceRole
    .from('responses')
    .select('case_id,response_id,answer_q1,answer_q2,answer_q3,answer_q4,answer_q5,answer_q6,answer_q7,answer_q8,score_problem,score_solution')
    .or(orFilter);

  const responseMap = new Map<string, ResponseData>();
  for (const r of (responses ?? []) as ResponseData[]) {
    responseMap.set(`${r.case_id}__${r.response_id}`, r);
  }

  let succeeded = 0;
  let failed = 0;
  const embeddings: { case_id: string; response_id: string; question: 'q1' | 'q2'; embedding: number[]; score: number | null; score_bucket: number }[] = [];
  const updateResults: { case_id: string; response_id: string; question: 'q1' | 'q2'; status: 'done' | 'error'; attempts: number; last_error: string | null }[] = [];

  for (const job of jobs) {
    const key = `${job.case_id}__${job.response_id}`;
    const resp = responseMap.get(key);
    const question = job.question as 'q1' | 'q2';
    const nextAtt = nextAttempts.get(`${key}__${question}`) ?? 1;

    let text = '';
    let score: number | null = null;

    if (question === 'q1') {
      text = resp?.answer_q1?.trim() ?? '';
      score = resp?.score_problem ?? null;
    } else {
      const parts = [resp?.answer_q2, resp?.answer_q3, resp?.answer_q4, resp?.answer_q5, resp?.answer_q6, resp?.answer_q7, resp?.answer_q8]
        .filter(Boolean)
        .map(s => String(s).trim())
        .filter(Boolean);
      text = parts.join('\n\n');
      score = resp?.score_solution ?? null;
    }

    if (!text) {
      updateResults.push({ case_id: job.case_id, response_id: job.response_id, question, status: 'error', attempts: nextAtt, last_error: 'テキストが空' });
      failed++;
      continue;
    }

    try {
      const result = await withRetry(() => embedText(text));
      embeddings.push({
        case_id: job.case_id,
        response_id: job.response_id,
        question,
        embedding: result.values,
        score,
        score_bucket: toScoreBucket(score ?? 0),
      });
      updateResults.push({ case_id: job.case_id, response_id: job.response_id, question, status: 'done', attempts: nextAtt, last_error: null });
      succeeded++;
    } catch (e) {
      const errMsg = e instanceof Error ? e.message : String(e);
      updateResults.push({ case_id: job.case_id, response_id: job.response_id, question, status: 'error', attempts: nextAtt, last_error: errMsg.slice(0, 500) });
      failed++;
    }
  }

  // エンベディングを保存
  if (embeddings.length > 0) {
    const rows = embeddings.map(e => ({
      case_id: e.case_id,
      response_id: e.response_id,
      question: e.question,
      embedding: e.embedding,
      score: e.score,
      score_bucket: e.score_bucket,
      embedding_model: EMBEDDING_MODEL,
      embedding_dim: EMBEDDING_DIM,
    }));

    const { error: insertError } = await supabaseServiceRole.from('response_embeddings').upsert(
      rows,
      { onConflict: 'case_id,response_id,question' }
    );
    if (insertError) {
      console.error('insertResponseEmbeddings error:', insertError);
    }
  }

  // キューのステータスを更新
  for (const u of updateResults) {
    await supabaseServiceRole
      .from('embedding_queue')
      .update({
        status: u.status,
        attempts: u.attempts,
        last_error: u.last_error,
        updated_at: new Date().toISOString(),
      })
      .eq('case_id', u.case_id)
      .eq('response_id', u.response_id)
      .eq('question', u.question);
  }

  console.log(`[processEmbeddingServiceRole] 完了: succeeded=${succeeded}, failed=${failed}`);
  return { processed: jobs.length, succeeded, failed };
}

// 典型例再計算（Service Role版）
export async function rebuildTypicalExamplesForBucketServiceRole(params: {
  caseId: string;
  question: 'q1' | 'q2';
  scoreBucket: number;
  maxClusters?: number;
}): Promise<{ clusters: number; points: number }> {
  const { caseId, question, scoreBucket, maxClusters = 3 } = params;
  const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

  // 既存の典型例を削除
  await supabaseServiceRole
    .from('typical_examples')
    .delete()
    .eq('case_id', caseId)
    .eq('question', question)
    .eq('score_bucket', scoreBucket);

  // エンベディングを取得
  const { data: embData } = await supabaseServiceRole
    .from('response_embeddings')
    .select('case_id,response_id,question,score,score_bucket,embedding')
    .eq('case_id', caseId)
    .eq('question', question)
    .eq('score_bucket', scoreBucket)
    .limit(5000);

  if (!embData || embData.length === 0) {
    return { clusters: 0, points: 0 };
  }

  type EmbeddingData = {
    case_id: string;
    response_id: string;
    question: string;
    score: number | null;
    score_bucket: number;
    embedding: unknown;
  };
  const typedEmbData = embData as EmbeddingData[];
  const n = typedEmbData.length;
  const k = Math.min(maxClusters, n);

  const vectors = typedEmbData.map(r => parseVector(r.embedding));
  const clusters = kmeansCosine(vectors, k);

  // 各クラスタの代表を選択
  const clusterInfos: { clusterId: number; clusterSize: number; centroid: Vector; repMember: EmbeddingData; distance: number }[] = [];
  clusters.forEach((cluster, clusterId) => {
    if (cluster.indices.length === 0) return;

    let bestIdx = cluster.indices[0];
    let bestDist = Infinity;
    for (const i of cluster.indices) {
      const d = cosineDistance(vectors[i], cluster.centroid);
      if (d < bestDist) {
        bestDist = d;
        bestIdx = i;
      }
    }

    clusterInfos.push({
      clusterId,
      clusterSize: cluster.indices.length,
      centroid: cluster.centroid,
      repMember: typedEmbData[bestIdx],
      distance: bestDist,
    });
  });

  // 代表の解答テキストを取得
  type ResponseData2 = {
    case_id: string;
    response_id: string;
    answer_q1: string | null;
    answer_q2: string | null;
    answer_q3: string | null;
    answer_q4: string | null;
    answer_q5: string | null;
    answer_q6: string | null;
    answer_q7: string | null;
    answer_q8: string | null;
    score_problem: number | null;
    score_solution: number | null;
  };
  const repKeys = clusterInfos.map(c => c.repMember);
  const orFilter = repKeys.map(m => `and(case_id.eq.${m.case_id},response_id.eq.${m.response_id})`).join(',');
  const { data: respData } = await supabaseServiceRole
    .from('responses')
    .select('case_id,response_id,answer_q1,answer_q2,answer_q3,answer_q4,answer_q5,answer_q6,answer_q7,answer_q8,score_problem,score_solution')
    .or(orFilter);

  const respMap = new Map<string, ResponseData2>();
  for (const r of (respData ?? []) as ResponseData2[]) {
    respMap.set(`${r.case_id}__${r.response_id}`, r);
  }

  type TypicalExampleInsert = Database['public']['Tables']['typical_examples']['Insert'];
  const rows: TypicalExampleInsert[] = [];
  for (const r of clusterInfos) {
    const embRow = r.repMember;
    const resp = respMap.get(`${embRow.case_id}__${embRow.response_id}`);
    let repText = '';
    let repScore: number | null = null;

    if (question === 'q1') {
      repText = resp?.answer_q1?.trim() ?? '';
      repScore = resp?.score_problem ?? null;
    } else {
      const parts = [resp?.answer_q2, resp?.answer_q3, resp?.answer_q4, resp?.answer_q5, resp?.answer_q6, resp?.answer_q7, resp?.answer_q8]
        .filter(Boolean)
        .map(s => String(s).trim())
        .filter(Boolean);
      repText = parts.join('\n\n');
      repScore = resp?.score_solution ?? null;
    }

    if (!repText) continue;

    rows.push({
      case_id: caseId,
      question,
      score_bucket: scoreBucket,
      cluster_id: r.clusterId,
      cluster_size: r.clusterSize,
      centroid: r.centroid as unknown,
      rep_case_id: caseId,
      rep_response_id: embRow.response_id,
      rep_text: repText,
      rep_score: repScore,
      rep_distance: r.distance,
      embedding_model: EMBEDDING_MODEL,
      embedding_dim: EMBEDDING_DIM,
    });
  }

  if (rows.length > 0) {
    await supabaseServiceRole.from('typical_examples').upsert(rows, {
      onConflict: 'case_id,question,score_bucket,cluster_id',
    });
  }

  return { clusters: rows.length, points: n };
}

