// 予測履歴を管理するServer Actions

'use server';

import { getAnyAccessToken, getAuthedUserId, hasAccessToken, getAccessToken } from '@/lib/supabase/server';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import type { ScoreItems } from '@/lib/scoring';
import type { Scores, PredictionResponse } from '@/types';

// 予測タイプ
export type PredictionType = 'score_existing' | 'score_new' | 'answer';

// 履歴レコードの型
export interface PredictionHistoryRecord {
  id: string;
  user_id: string;
  prediction_type: PredictionType;
  case_id: string | null;
  case_name: string | null;
  situation_text: string | null;
  input_q1_answer: string | null;
  input_q2_answer: string | null;
  input_scores: Scores | null;
  result_scores: ScoreItems | null;
  result_explanation: string | null;
  confidence: number | null;
  result_predicted_q1: string | null;
  result_predicted_q2: string | null;
  created_at: string;
  // 管理者用：ユーザー情報
  user_email?: string | null;
  user_name?: string | null;
}

// スコア予測の履歴を保存（既存ケース）
export async function savePredictionHistoryExisting(params: {
  caseId: string;
  caseName: string | null;
  q1Answer: string;
  q2Answer: string;
  resultScores: ScoreItems;
  explanation: string;
  confidence: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAnyAccessToken();
    const userId = await getAuthedUserId();

    if (!token || !userId) {
      return { success: false, error: '認証が必要です' };
    }

    const supabase = createAuthedAnonServerClient(token);

    const { error } = await supabase.from('prediction_history').insert({
      user_id: userId,
      prediction_type: 'score_existing' as PredictionType,
      case_id: params.caseId,
      case_name: params.caseName,
      input_q1_answer: params.q1Answer,
      input_q2_answer: params.q2Answer,
      result_scores: params.resultScores as unknown as Record<string, unknown>,
      result_explanation: params.explanation,
      confidence: params.confidence,
    });

    if (error) {
      console.error('savePredictionHistoryExisting error:', error);
      return { success: false, error: '履歴の保存に失敗しました' };
    }

    return { success: true };
  } catch (error) {
    console.error('savePredictionHistoryExisting error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴の保存に失敗しました',
    };
  }
}

// スコア予測の履歴を保存（新規ケース）
export async function savePredictionHistoryNew(params: {
  situationText: string;
  q1Answer: string;
  q2Answer: string;
  resultScores: ScoreItems;
  explanation: string;
  confidence: number;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAnyAccessToken();
    const userId = await getAuthedUserId();

    if (!token || !userId) {
      return { success: false, error: '認証が必要です' };
    }

    const supabase = createAuthedAnonServerClient(token);

    const { error } = await supabase.from('prediction_history').insert({
      user_id: userId,
      prediction_type: 'score_new' as PredictionType,
      situation_text: params.situationText,
      input_q1_answer: params.q1Answer,
      input_q2_answer: params.q2Answer,
      result_scores: params.resultScores as unknown as Record<string, unknown>,
      result_explanation: params.explanation,
      confidence: params.confidence,
    });

    if (error) {
      console.error('savePredictionHistoryNew error:', error);
      return { success: false, error: '履歴の保存に失敗しました' };
    }

    return { success: true };
  } catch (error) {
    console.error('savePredictionHistoryNew error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴の保存に失敗しました',
    };
  }
}

// 解答予測の履歴を保存
export async function savePredictionHistoryAnswer(params: {
  caseId: string;
  caseName: string | null;
  inputScores: Scores;
  resultQ1: string;
  resultQ2: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const token = await getAnyAccessToken();
    const userId = await getAuthedUserId();

    if (!token || !userId) {
      return { success: false, error: '認証が必要です' };
    }

    const supabase = createAuthedAnonServerClient(token);

    const { error } = await supabase.from('prediction_history').insert({
      user_id: userId,
      prediction_type: 'answer' as PredictionType,
      case_id: params.caseId,
      case_name: params.caseName,
      input_scores: params.inputScores as unknown as Record<string, unknown>,
      result_predicted_q1: params.resultQ1,
      result_predicted_q2: params.resultQ2,
    });

    if (error) {
      console.error('savePredictionHistoryAnswer error:', error);
      return { success: false, error: '履歴の保存に失敗しました' };
    }

    return { success: true };
  } catch (error) {
    console.error('savePredictionHistoryAnswer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴の保存に失敗しました',
    };
  }
}

// 履歴一覧を取得
export async function fetchPredictionHistory(params?: {
  type?: PredictionType | 'score_all'; // score_all は既存+新規のスコア予測
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  records?: PredictionHistoryRecord[];
  total?: number;
  error?: string;
}> {
  try {
    const token = await getAnyAccessToken();
    const userId = await getAuthedUserId();

    if (!token || !userId) {
      return { success: false, error: '認証が必要です' };
    }

    const supabase = createAuthedAnonServerClient(token);

    let query = supabase
      .from('prediction_history')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    // タイプでフィルタ
    if (params?.type === 'score_all') {
      query = query.in('prediction_type', ['score_existing', 'score_new']);
    } else if (params?.type) {
      query = query.eq('prediction_type', params.type);
    }

    // ページネーション
    const limit = params?.limit ?? 20;
    const offset = params?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('fetchPredictionHistory error:', error);
      return { success: false, error: '履歴の取得に失敗しました' };
    }

    return {
      success: true,
      records: data as PredictionHistoryRecord[],
      total: count ?? 0,
    };
  } catch (error) {
    console.error('fetchPredictionHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴の取得に失敗しました',
    };
  }
}

// 履歴詳細を取得
export async function fetchPredictionHistoryById(
  id: string
): Promise<{
  success: boolean;
  record?: PredictionHistoryRecord;
  error?: string;
}> {
  try {
    const token = await getAnyAccessToken();
    const userId = await getAuthedUserId();

    if (!token || !userId) {
      return { success: false, error: '認証が必要です' };
    }

    const supabase = createAuthedAnonServerClient(token);

    const { data, error } = await supabase
      .from('prediction_history')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .single();

    if (error) {
      console.error('fetchPredictionHistoryById error:', error);
      return { success: false, error: '履歴の取得に失敗しました' };
    }

    return { success: true, record: data as PredictionHistoryRecord };
  } catch (error) {
    console.error('fetchPredictionHistoryById error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴の取得に失敗しました',
    };
  }
}

// 管理者権限チェック
async function ensureAdmin(): Promise<void> {
  if (!(await hasAccessToken())) {
    throw new Error('管理者権限が必要です');
  }
}

// 管理者用：全ユーザーの履歴一覧を取得
export async function adminFetchPredictionHistory(params?: {
  type?: PredictionType | 'score_all';
  userId?: string; // 特定ユーザーでフィルタ
  limit?: number;
  offset?: number;
}): Promise<{
  success: boolean;
  records?: PredictionHistoryRecord[];
  total?: number;
  error?: string;
}> {
  try {
    await ensureAdmin();
    const token = await getAccessToken();

    if (!token) {
      return { success: false, error: '管理者権限が必要です' };
    }

    const supabase = createAuthedAnonServerClient(token);

    // まず履歴データを取得
    let query = supabase
      .from('prediction_history')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    // 特定ユーザーでフィルタ
    if (params?.userId) {
      query = query.eq('user_id', params.userId);
    }

    // タイプでフィルタ
    if (params?.type === 'score_all') {
      query = query.in('prediction_type', ['score_existing', 'score_new']);
    } else if (params?.type) {
      query = query.eq('prediction_type', params.type);
    }

    // ページネーション
    const limit = params?.limit ?? 50;
    const offset = params?.offset ?? 0;
    query = query.range(offset, offset + limit - 1);

    const { data, count, error } = await query;

    if (error) {
      console.error('adminFetchPredictionHistory error:', error);
      return { success: false, error: '履歴の取得に失敗しました' };
    }

    // ユーザーIDのリストを取得
    const userIds = [...new Set((data ?? []).map((row: any) => row.user_id))];

    // ユーザー情報を取得
    let userMap: Record<string, { email: string | null; name: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, email, name')
        .in('id', userIds);

      if (profiles) {
        userMap = profiles.reduce((acc: Record<string, { email: string | null; name: string | null }>, profile: any) => {
          acc[profile.id] = { email: profile.email, name: profile.name };
          return acc;
        }, {});
      }
    }

    // データを整形（profiles情報をマージ）
    const records: PredictionHistoryRecord[] = (data ?? []).map((row: any) => ({
      id: row.id,
      user_id: row.user_id,
      prediction_type: row.prediction_type,
      case_id: row.case_id,
      case_name: row.case_name,
      situation_text: row.situation_text,
      input_q1_answer: row.input_q1_answer,
      input_q2_answer: row.input_q2_answer,
      input_scores: row.input_scores,
      result_scores: row.result_scores,
      result_explanation: row.result_explanation,
      confidence: row.confidence,
      result_predicted_q1: row.result_predicted_q1,
      result_predicted_q2: row.result_predicted_q2,
      created_at: row.created_at,
      user_email: userMap[row.user_id]?.email ?? null,
      user_name: userMap[row.user_id]?.name ?? null,
    }));

    return {
      success: true,
      records,
      total: count ?? 0,
    };
  } catch (error) {
    console.error('adminFetchPredictionHistory error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '履歴の取得に失敗しました',
    };
  }
}
