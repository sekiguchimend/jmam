// Supabase データベースクエリ関数
// Server Component / Server Actions から呼び出すクエリロジック
// SE-03: ブラウザからDBへ直接アクセスさせない（サーバー専用モジュール）
import 'server-only';

import { createSupabaseServerClient } from './server';
import { createAuthedAnonServerClient } from './authed-anon-server';
import { getAccessToken } from './server';
import type { Case, Response, Scores, DatasetStats } from '@/types';
import type { Database } from '@/types/database';

type CaseInsert = Database['public']['Tables']['cases']['Insert'];
type ResponseInsert = Database['public']['Tables']['responses']['Insert'];

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
  const res = await (supabase.from('cases') as any).upsert(caseData satisfies CaseInsert, { onConflict: 'case_id' });
  const { error } = res as { error: any };

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
  const res = await (supabase.from('responses') as any).upsert(responses satisfies ResponseInsert[], {
    onConflict: 'case_id,response_id',
  });
  const { error } = res as { error: any };

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
