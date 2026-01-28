// Supabase データベースクエリ関数
// Server Component / Server Actions から呼び出すクエリロジック
// SE-03: ブラウザからDBへ直接アクセスさせない（サーバー専用モジュール）
import 'server-only';

import { createSupabaseServerClient } from './server';
import { createAuthedAnonServerClient } from './authed-anon-server';
import { getAccessToken } from './server';
import type { Case, Response, Scores, DatasetStats, TypicalExample, Question } from '@/types';
import type { Database, QuestionInsert } from '@/types/database';

type CaseInsert = Database['public']['Tables']['cases']['Insert'];
type ResponseInsert = Database['public']['Tables']['responses']['Insert'];
type EmbeddingQueueInsert = Database['public']['Tables']['embedding_queue']['Insert'];
type ResponseEmbeddingInsert = Database['public']['Tables']['response_embeddings']['Insert'];
type TypicalExampleInsert = Database['public']['Tables']['typical_examples']['Insert'];

// ============================================
// ケース関連クエリ
// ============================================

// ケース問題一覧を取得
export async function getCases(): Promise<Case[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cases')
    .select('case_id, case_name, situation_text')
    .order('case_id');

  if (error) {
    console.error('getCases error:', error);
    throw new Error(`ケース一覧の取得に失敗しました: ${error.message}`);
  }
  return data ?? [];
}

// 特定のケースを取得
export async function getCaseById(caseId: string): Promise<Case | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('cases')
    .select('case_id, case_name, situation_text')
    .eq('case_id', caseId)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    console.error('getCaseById error:', error);
    throw new Error(`ケースの取得に失敗しました: ${error.message}`);
  }
  return data;
}

// ============================================
// 回答データクエリ
// ============================================

// 類似スコアの回答を検索（RAG用）
// idx_responses_on_scores インデックスを活用
export async function findSimilarResponses(
  caseId: string,
  scores: Scores,
  limit: number = 5
): Promise<Response[]> {
  const supabase = await createSupabaseServerClient();
  const tolerance = 0.5; // スコア許容範囲

  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('case_id', caseId)
    .gte('score_problem', scores.problem - tolerance)
    .lte('score_problem', scores.problem + tolerance)
    .gte('score_solution', scores.solution - tolerance)
    .lte('score_solution', scores.solution + tolerance)
    .gte('score_role', scores.role - tolerance)
    .lte('score_role', scores.role + tolerance)
    .limit(limit);

  if (error) {
    console.error('findSimilarResponses error:', error);
    throw new Error(`類似回答の検索に失敗しました: ${error.message}`);
  }
  return (data ?? []) as Response[];
}

// ユークリッド距離を計算
function euclideanDistance(target: Scores, response: Response): number {
  const t = [target.problem, target.solution, target.role, target.leadership, target.collaboration, target.development];
  const r = [
    response.score_problem ?? 0,
    response.score_solution ?? 0,
    response.score_role ?? 0,
    response.score_leadership ?? 0,
    response.score_collaboration ?? 0,
    response.score_development ?? 0,
  ];
  let sum = 0;
  for (let i = 0; i < 6; i++) {
    sum += (t[i] - r[i]) ** 2;
  }
  return Math.sqrt(sum);
}

// ベクトルの重心を計算
function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += v[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
  }
  return centroid;
}

// コサイン類似度を計算
function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// 6指標のユークリッド距離で類似回答を検索
// ケース内の全回答からスコアが最も近い人を取得
// トップタイ（同距離）が複数ある場合はエンベディング重心で最も典型的なものを選ぶ
export async function findSimilarResponsesByEuclidean(
  caseId: string,
  scores: Scores,
  limit: number = 5
): Promise<{ response: Response; distance: number }[]> {
  const supabase = await createSupabaseServerClient();

  // ケースで絞って必要なカラムだけ取得（answer_q2〜q8は設問2の回答）
  const { data, error } = await supabase
    .from('responses')
    .select('id, response_id, case_id, answer_q1, answer_q2, answer_q3, answer_q4, answer_q5, answer_q6, answer_q7, answer_q8, score_problem, score_solution, score_role, score_leadership, score_collaboration, score_development')
    .eq('case_id', caseId)
    .not('answer_q1', 'is', null);

  if (error) {
    console.error('findSimilarResponsesByEuclidean error:', error);
    throw new Error(`類似回答の検索に失敗しました: ${error.message}`);
  }

  if (!data || data.length === 0) {
    return [];
  }

  // 全件に対してユークリッド距離を計算してソート
  const withDistance = (data as Response[]).map((r) => ({
    response: r,
    distance: euclideanDistance(scores, r),
  }));
  withDistance.sort((a, b) => a.distance - b.distance);

  // トップタイ（最小距離と同じ距離を持つもの）を抽出
  const minDistance = withDistance[0].distance;
  const topTied = withDistance.filter((r) => r.distance === minDistance);

  // トップタイが1件ならそのまま、複数ならエンベディング重心で選ぶ
  if (topTied.length <= 1) {
    return withDistance.slice(0, limit);
  }

  // トップタイが複数ある場合、DBに保存済みのエンベディング重心に最も近いものを選ぶ
  try {
    // トップタイのresponse_idリストを作成
    const responseIds = topTied.map((t) => t.response.response_id);

    // DBから保存済みエンベディングを取得（problemを使用）
    const { data: embeddingData, error: embError } = await supabase
      .from('response_embeddings')
      .select('response_id, embedding')
      .eq('case_id', caseId)
      .eq('question', 'problem')
      .in('response_id', responseIds) as { data: { response_id: string; embedding: number[] | null }[] | null; error: unknown };

    if (embError || !embeddingData || embeddingData.length === 0) {
      // エンベディングがない場合は単純ソートにフォールバック
      console.warn('No embeddings found for top tied responses, falling back to simple sort');
      return withDistance.slice(0, limit);
    }

    // エンベディングをマップ化
    const embeddingMap = new Map<string, number[]>();
    for (const row of embeddingData) {
      if (Array.isArray(row.embedding)) {
        embeddingMap.set(row.response_id, row.embedding);
      }
    }

    // エンベディングがある回答のみ抽出
    const embeddings: { response: Response; distance: number; embedding: number[] }[] = [];
    for (const item of topTied) {
      const emb = embeddingMap.get(item.response.response_id);
      if (emb) {
        embeddings.push({ ...item, embedding: emb });
      }
    }

    if (embeddings.length === 0) {
      return withDistance.slice(0, limit);
    }

    // 重心を計算
    const centroid = computeCentroid(embeddings.map((e) => e.embedding));

    // 重心に最も近いものを選ぶ
    let bestIdx = 0;
    let bestSim = -Infinity;
    for (let i = 0; i < embeddings.length; i++) {
      const sim = cosineSimilarity(embeddings[i].embedding, centroid);
      if (sim > bestSim) {
        bestSim = sim;
        bestIdx = i;
      }
    }

    // 結果を構築: 重心に最も近いもの + 残りを距離順で埋める
    const result: { response: Response; distance: number }[] = [
      { response: embeddings[bestIdx].response, distance: embeddings[bestIdx].distance }
    ];

    // 残りの枠を埋める（トップタイ以外から距離順）
    const remaining = withDistance.filter(
      (r) => r.distance !== minDistance || r.response.id === embeddings[bestIdx].response.id
    );
    for (const r of remaining) {
      if (result.length >= limit) break;
      if (r.response.id !== embeddings[bestIdx].response.id) {
        result.push(r);
      }
    }

    return result.slice(0, limit);
  } catch (e) {
    console.error('Embedding centroid calculation failed, falling back to simple sort:', e);
    // エンベディング失敗時は単純ソートにフォールバック
    return withDistance.slice(0, limit);
  }
}

// 拡張検索：スコアが近い順に取得（許容範囲を段階的に広げる）
export async function findSimilarResponsesWithFallback(
  caseId: string,
  scores: Scores,
  minResults: number = 3,
  maxResults: number = 10
): Promise<Response[]> {
  const supabase = await createSupabaseServerClient();
  const tolerances = [0.3, 0.5, 1.0, 1.5];

  for (const tolerance of tolerances) {
    const { data, error } = await supabase
      .from('responses')
      .select('*')
      .eq('case_id', caseId)
      .gte('score_problem', scores.problem - tolerance)
      .lte('score_problem', scores.problem + tolerance)
      .gte('score_solution', scores.solution - tolerance)
      .lte('score_solution', scores.solution + tolerance)
      .limit(maxResults);

    if (error) {
      console.error('findSimilarResponsesWithFallback error:', error);
      continue;
    }

    if (data && data.length >= minResults) {
      return data as Response[];
    }
  }

  // 最終手段：ケースIDのみでフィルタリング
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .eq('case_id', caseId)
    .limit(maxResults);

  if (error) {
    throw new Error(`回答の検索に失敗しました: ${error.message}`);
  }
  return (data ?? []) as Response[];
}

// RAG用：高スコア・低スコアの回答を含む包括的なデータ取得
// AIがパターン分析するために、スコア帯ごとのサンプルを取得
export async function findResponsesForRAG(
  caseId: string,
  _scores: Scores,
  maxPerCategory: number = 5
): Promise<Response[]> {
  const supabase = await createSupabaseServerClient();
  const results: Response[] = [];

  // 1. 高スコア回答（問題把握・対策立案ともに3.0以上）
  const { data: highScorers, error: highError } = await supabase
    .from('responses')
    .select('*')
    .eq('case_id', caseId)
    .gte('score_problem', 3.0)
    .gte('score_solution', 3.0)
    .not('answer_q1', 'is', null)
    .order('score_problem', { ascending: false })
    .limit(maxPerCategory);

  if (!highError && highScorers) {
    results.push(...(highScorers as Response[]));
  }

  // 2. 中スコア回答（2.0-3.0）
  const { data: midScorers, error: midError } = await supabase
    .from('responses')
    .select('*')
    .eq('case_id', caseId)
    .gte('score_problem', 2.0)
    .lt('score_problem', 3.0)
    .not('answer_q1', 'is', null)
    .limit(maxPerCategory);

  if (!midError && midScorers) {
    results.push(...(midScorers as Response[]));
  }

  // 3. 低スコア回答（2.0未満）- 避けるべきパターンとして
  const { data: lowScorers, error: lowError } = await supabase
    .from('responses')
    .select('*')
    .eq('case_id', caseId)
    .lt('score_problem', 2.0)
    .not('answer_q1', 'is', null)
    .limit(Math.floor(maxPerCategory / 2));

  if (!lowError && lowScorers) {
    results.push(...(lowScorers as Response[]));
  }

  // 重複除去
  const uniqueMap = new Map<string, Response>();
  for (const r of results) {
    uniqueMap.set(r.id, r);
  }

  return Array.from(uniqueMap.values());
}

// ============================================
// データセット統計クエリ (FR-12)
// ============================================

// ケースごとの回答数を取得（DB側でGROUP BY集計して効率化）
export async function getDatasetStats(): Promise<DatasetStats[]> {
  const supabase = await createSupabaseServerClient();

  // casesテーブルとレスポンスカウントを並行取得
  const [casesResult, countsResult] = await Promise.all([
    supabase
      .from('cases')
      .select('case_id, case_name')
      .order('case_id') as unknown as Promise<{ data: { case_id: string; case_name: string | null }[] | null; error: Error | null }>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase.rpc as any)('get_response_counts_by_case') as Promise<{ data: { case_id: string; record_count: number }[] | null; error: Error | null }>,
  ]);

  if (casesResult.error) {
    console.error('getDatasetStats cases error:', casesResult.error);
    throw new Error(`ケース一覧の取得に失敗しました: ${casesResult.error.message}`);
  }

  if (countsResult.error) {
    console.error('getDatasetStats counts error:', countsResult.error);
    throw new Error(`データセット統計の取得に失敗しました: ${countsResult.error.message}`);
  }

  // カウント結果をMapに変換
  const countMap = new Map<string, number>();
  for (const row of countsResult.data ?? []) {
    countMap.set(row.case_id, row.record_count);
  }

  // 結果を作成（カウントが0より大きいケースのみ）
  const stats: DatasetStats[] = [];
  for (const c of casesResult.data ?? []) {
    const recordCount = countMap.get(c.case_id) ?? 0;
    if (recordCount > 0) {
      stats.push({
        caseId: c.case_id,
        caseName: c.case_name,
        recordCount,
      });
    }
  }

  return stats;
}

// 総回答数を取得
export async function getTotalResponseCount(): Promise<number> {
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('getTotalResponseCount error:', error);
    throw new Error(`総回答数の取得に失敗しました: ${error.message}`);
  }
  return count ?? 0;
}

// ============================================
// データ登録クエリ（Server Action用）
// anon key + 管理者JWT(Authorization) でRLSを通して書き込み
// ============================================

// ケースをupsert
export async function upsertCase(caseData: CaseInsert, accessToken?: string): Promise<void> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase.from('cases').upsert(caseData satisfies CaseInsert, { onConflict: 'case_id' });

  if (error) {
    console.error('upsertCase error:', error);
    throw new Error(`ケースの登録に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

// ケースの内容（シチュエーション）を更新
export async function updateCaseSituation(
  caseId: string,
  data: {
    situation_text: string;
    situation_embedding: number[];
    embedding_model: string;
  },
  accessToken?: string
): Promise<void> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase
    .from('cases')
    .update({
      situation_text: data.situation_text,
      situation_embedding: data.situation_embedding,
      embedding_model: data.embedding_model,
    })
    .eq('case_id', caseId);

  if (error) {
    console.error('updateCaseSituation error:', error);
    throw new Error(`ケース内容の更新に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

// 回答データをバッチupsert（FR-09: 1000件単位）
export async function upsertResponses(responses: ResponseInsert[], accessToken?: string): Promise<void> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase.from('responses').upsert(responses satisfies ResponseInsert[], {
    onConflict: 'case_id,response_id',
  });

  if (error) {
    console.error('upsertResponses error:', error);
    throw new Error(`回答データの登録に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

// ケースの回答を全削除（データセット削除用）
export async function deleteResponsesByCaseId(caseId: string, accessToken?: string): Promise<number> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { data, error } = await supabase
    .from('responses')
    .delete()
    .eq('case_id', caseId)
    .select('id');

  if (error) {
    console.error('deleteResponsesByCaseId error:', error);
    throw new Error(`回答データの削除に失敗しました: ${error.message}`);
  }
  return data?.length ?? 0;
}

// ============================================
// Embedding / 典型例（事前準備用）
// ============================================

export async function enqueueEmbeddingJobs(
  jobs: EmbeddingQueueInsert[],
  accessToken?: string
): Promise<void> {
  if (jobs.length === 0) return;
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase.from('embedding_queue').upsert(jobs satisfies EmbeddingQueueInsert[], {
    onConflict: 'case_id,response_id,question',
  });
  if (error) {
    console.error('enqueueEmbeddingJobs error:', error);
    throw new Error(`embedding_queue の登録に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

export async function fetchPendingEmbeddingJobs(
  limit: number,
  accessToken?: string
): Promise<
  { case_id: string; response_id: string; question: 'q1' | 'q2'; attempts: number }[]
> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { data, error } = await supabase
    .from('embedding_queue')
    .select('case_id,response_id,question,attempts')
    .eq('status', 'pending')
    .order('updated_at', { ascending: true })
    .limit(limit);

  if (error) {
    console.error('fetchPendingEmbeddingJobs error:', error);
    throw new Error(`embedding_queue の取得に失敗しました: ${error.message}`);
  }
  return (data ?? []) as { case_id: string; response_id: string; question: 'q1' | 'q2'; attempts: number }[];
}

export async function markEmbeddingJobs(
  updates: {
    case_id: string;
    response_id: string;
    question: 'q1' | 'q2';
    status: 'pending' | 'processing' | 'done' | 'error';
    attempts?: number;
    last_error?: string | null;
  }[],
  accessToken?: string
): Promise<void> {
  if (updates.length === 0) return;
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase.from('embedding_queue').upsert(
    updates.map((u) => ({
      case_id: u.case_id,
      response_id: u.response_id,
      question: u.question,
      status: u.status,
      attempts: u.attempts,
      last_error: u.last_error,
    })) satisfies EmbeddingQueueInsert[],
    { onConflict: 'case_id,response_id,question' }
  );
  if (error) {
    console.error('markEmbeddingJobs error:', error);
    throw new Error(`embedding_queue の更新に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

export async function fetchResponsesForEmbeddingJobs(
  jobs: { case_id: string; response_id: string; question: 'q1' | 'q2' }[]
): Promise<
  {
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
  }[]
> {
  if (jobs.length === 0) return [];
  const supabase = await createSupabaseServerClient();
  // (case_id,response_id) の複合キーなので OR を組み立てる
  const or = jobs.map((j) => `and(case_id.eq.${j.case_id},response_id.eq.${j.response_id})`).join(',');
  const { data, error } = await supabase
    .from('responses')
    .select('case_id,response_id,answer_q1,answer_q2,answer_q3,answer_q4,answer_q5,answer_q6,answer_q7,answer_q8,score_problem,score_solution')
    .or(or);

  if (error) {
    console.error('fetchResponsesForEmbeddingJobs error:', error);
    throw new Error(`回答テキストの取得に失敗しました: ${error.message}`);
  }
  return (data ?? []) as {
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
  }[];
}

export async function upsertResponseEmbeddings(
  rows: ResponseEmbeddingInsert[],
  accessToken?: string
): Promise<void> {
  if (rows.length === 0) return;
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase.from('response_embeddings').upsert(rows satisfies ResponseEmbeddingInsert[], {
    onConflict: 'case_id,response_id,question',
  });
  if (error) {
    console.error('upsertResponseEmbeddings error:', error);
    throw new Error(`response_embeddings の登録に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

export async function upsertTypicalExamples(
  rows: TypicalExampleInsert[],
  accessToken?: string
): Promise<void> {
  if (rows.length === 0) return;
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase.from('typical_examples').upsert(rows satisfies TypicalExampleInsert[], {
    onConflict: 'case_id,question,score_bucket,cluster_id',
  });
  if (error) {
    console.error('upsertTypicalExamples error:', error);
    throw new Error(`typical_examples の登録に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

export async function deleteTypicalExamplesForBucket(
  caseId: string,
  question: 'q1' | 'q2',
  scoreBucket: number,
  accessToken?: string
): Promise<void> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase
    .from('typical_examples')
    .delete()
    .eq('case_id', caseId)
    .eq('question', question)
    .eq('score_bucket', scoreBucket);
  if (error) {
    console.error('deleteTypicalExamplesForBucket error:', error);
    throw new Error(`typical_examples の削除に失敗しました: ${error.message}`);
  }
}

export async function getTypicalExamples(
  caseId: string,
  question: 'q1' | 'q2',
  scoreBucket: number,
  limit: number = 2
): Promise<TypicalExample[]> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('typical_examples')
    .select('case_id,question,score_bucket,cluster_id,cluster_size,rep_text,rep_score')
    .eq('case_id', caseId)
    .eq('question', question)
    .eq('score_bucket', scoreBucket)
    .order('cluster_size', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('getTypicalExamples error:', error);
    throw new Error(`typical_examples の取得に失敗しました: ${error.message}`);
  }
  return (data ?? []) as TypicalExample[];
}

export async function fetchEmbeddingsForBucket(
  caseId: string,
  question: 'q1' | 'q2',
  scoreBucket: number,
  limit: number = 5000
): Promise<
  {
    case_id: string;
    response_id: string;
    question: 'q1' | 'q2';
    score: number | null;
    score_bucket: number;
    embedding: unknown;
  }[]
> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase
    .from('response_embeddings')
    .select('case_id,response_id,question,score,score_bucket,embedding')
    .eq('case_id', caseId)
    .eq('question', question)
    .eq('score_bucket', scoreBucket)
    .limit(limit);

  if (error) {
    console.error('fetchEmbeddingsForBucket error:', error);
    throw new Error(`response_embeddings の取得に失敗しました: ${error.message}`);
  }
  return (data ?? []) as {
    case_id: string;
    response_id: string;
    question: 'q1' | 'q2';
    score: number | null;
    score_bucket: number;
    embedding: unknown;
  }[];
}

// ============================================
// 設問管理クエリ
// ============================================

// 設問を取得
export async function getQuestionsByCase(caseId: string, accessToken?: string): Promise<Question[]> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);

  const { data, error } = await supabase
    .from('questions')
    .select('id, case_id, question_key, question_text, question_embedding, order_index')
    .eq('case_id', caseId)
    .order('order_index', { ascending: true });

  if (error) {
    console.error('getQuestionsByCase error:', error);
    throw new Error(`設問の取得に失敗しました: ${error.message}`);
  }
  return (data ?? []) as Question[];
}

// 設問を保存（upsert）
export async function upsertQuestion(
  data: {
    case_id: string;
    question_key: 'q1' | 'q2';
    question_text: string;
    question_embedding: number[];
    embedding_model: string;
  },
  accessToken?: string
): Promise<void> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);

  const insertData: QuestionInsert = {
    case_id: data.case_id,
    question_key: data.question_key,
    question_text: data.question_text,
    question_embedding: data.question_embedding,
    embedding_model: data.embedding_model,
    order_index: data.question_key === 'q1' ? 0 : 1,
  };

  const { error } = await supabase.from('questions').upsert(insertData, {
    onConflict: 'case_id,question_key',
  });

  if (error) {
    console.error('upsertQuestion error:', error);
    throw new Error(`設問の保存に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}

// 設問を削除
export async function deleteQuestion(
  caseId: string,
  questionKey: 'q1' | 'q2',
  accessToken?: string
): Promise<void> {
  const token = accessToken ?? (await getAccessToken());
  if (!token) throw new Error('管理者トークンが見つかりません（再ログインしてください）');
  const supabase = createAuthedAnonServerClient(token);

  const { error } = await supabase
    .from('questions')
    .delete()
    .eq('case_id', caseId)
    .eq('question_key', questionKey);

  if (error) {
    console.error('deleteQuestion error:', error);
    throw new Error(`設問の削除に失敗しました: ${error.message ?? 'unknown error'}`);
  }
}
