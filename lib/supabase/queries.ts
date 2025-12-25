// Supabase データベースクエリ関数
// Server Component / Server Actions から呼び出すクエリロジック
// SE-03: ブラウザからDBへ直接アクセスさせない（サーバー専用モジュール）
import 'server-only';

import { createSupabaseServerClient } from './server';
import { createAuthedAnonServerClient } from './authed-anon-server';
import { getAccessToken } from './server';
import type { Case, Response, Scores, DatasetStats, TypicalExample } from '@/types';
import type { Database } from '@/types/database';

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

// ケースごとの回答数を取得
export async function getDatasetStats(): Promise<DatasetStats[]> {
  const supabase = await createSupabaseServerClient();

  // casesテーブルから全ケース情報を取得
  const { data: cases, error: casesError } = await supabase
    .from('cases')
    .select('case_id, case_name')
    .order('case_id') as { data: { case_id: string; case_name: string | null }[] | null; error: Error | null };

  if (casesError) {
    console.error('getDatasetStats cases error:', casesError);
    throw new Error(`ケース一覧の取得に失敗しました: ${casesError.message}`);
  }

  // responsesからcase_idのみを取得（データ転送量削減）
  const { data: responses, error: responsesError } = await supabase
    .from('responses')
    .select('case_id') as { data: { case_id: string }[] | null; error: Error | null };

  if (responsesError) {
    console.error('getDatasetStats responses error:', responsesError);
    throw new Error(`データセット統計の取得に失敗しました: ${responsesError.message}`);
  }

  // ケースごとにカウント
  const countMap = new Map<string, number>();
  for (const row of responses ?? []) {
    const count = countMap.get(row.case_id) ?? 0;
    countMap.set(row.case_id, count + 1);
  }

  // 結果を作成（カウントが0より大きいケースのみ）
  const stats: DatasetStats[] = [];
  for (const c of cases ?? []) {
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
  { case_id: string; response_id: string; question: 'problem' | 'solution'; attempts: number }[]
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
  return (data ?? []) as { case_id: string; response_id: string; question: 'problem' | 'solution'; attempts: number }[];
}

export async function markEmbeddingJobs(
  updates: {
    case_id: string;
    response_id: string;
    question: 'problem' | 'solution';
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
  jobs: { case_id: string; response_id: string; question: 'problem' | 'solution' }[]
): Promise<
  {
    case_id: string;
    response_id: string;
    answer_q1: string | null;
    answer_q2: string | null;
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
    .select('case_id,response_id,answer_q1,answer_q2,score_problem,score_solution')
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
  question: 'problem' | 'solution',
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
  question: 'problem' | 'solution',
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
  question: 'problem' | 'solution',
  scoreBucket: number,
  limit: number = 5000
): Promise<
  {
    case_id: string;
    response_id: string;
    question: 'problem' | 'solution';
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
    question: 'problem' | 'solution';
    score: number | null;
    score_bucket: number;
    embedding: unknown;
  }[];
}
