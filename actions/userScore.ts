// ユーザースコア履歴のServer Actions
// 管理者画面・一般画面の双方で利用

'use server';

import { getAuthedUserId, getAnyAccessToken } from '@/lib/supabase/server';
import type { Scores } from '@/types';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';

export async function recordUserScores(params: {
  caseId: string;
  scores: Scores;
}): Promise<void> {
  const token = await getAnyAccessToken();
  const userId = await getAuthedUserId();
  if (!token || !userId) return;

  const supabase = createAuthedAnonServerClient(token);
  const { caseId, scores } = params;

  // leadership/collaboration/development は現状保存要件が無いので、
  // まずは「問題把握/対策立案/役割理解」の3軸を履歴化する
  const { error } = await supabase.from('user_score_records').insert({
    user_id: userId,
    case_id: caseId,
    score_problem: scores.problem,
    score_solution: scores.solution,
    score_role: scores.role,
  });

  if (error) {
    // 予測機能は継続したいのでthrowしない（ログのみ）
    console.error('recordUserScores error:', error);
  }
}

export async function listUserScoreRecords(params: {
  userId: string;
  limit?: number;
}): Promise<
  {
    id: string;
    user_id: string;
    case_id: string;
    score_problem: number;
    score_solution: number;
    score_role: number;
    created_at: string;
  }[]
> {
  const token = await getAnyAccessToken();
  if (!token) return [];
  const { userId, limit = 50 } = params;
  const supabase = createAuthedAnonServerClient(token);
  const { data, error } = await supabase
    .from('user_score_records')
    .select('id, user_id, case_id, score_problem, score_solution, score_role, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('listUserScoreRecords error:', error);
    return [];
  }

  return data ?? [];
}

export async function getUserScoreRecordById(params: {
  id: string;
}): Promise<{
  id: string;
  user_id: string;
  case_id: string;
  score_problem: number;
  score_solution: number;
  score_role: number;
  created_at: string;
} | null> {
  const token = await getAnyAccessToken();
  if (!token) return null;
  const { id } = params;
  const supabase = createAuthedAnonServerClient(token);
  const { data, error } = await supabase
    .from('user_score_records')
    .select('id, user_id, case_id, score_problem, score_solution, score_role, created_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('getUserScoreRecordById error:', error);
    return null;
  }
  return data ?? null;
}


