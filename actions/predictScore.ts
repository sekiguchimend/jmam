// 回答からスコアを予測するServer Actions

'use server';

import { getAnyAccessToken } from '@/lib/supabase/server';
import { predictScoreFromAnswer, type ScorePrediction } from '@/lib/scoring';
import { supabaseAnonServer } from '@/lib/supabase/anon-server';

// ケース一覧を取得
export async function fetchCasesForScorePrediction(): Promise<{
  success: boolean;
  cases?: Array<{ case_id: string; case_name: string | null; situation_text: string | null }>;
  error?: string;
}> {
  try {
    const token = await getAnyAccessToken();
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    const { data, error } = await supabaseAnonServer
      .from('cases')
      .select('case_id, case_name, situation_text')
      .order('case_name', { ascending: true });

    if (error) {
      console.error('fetchCasesForScorePrediction error:', error);
      return { success: false, error: 'ケース一覧の取得に失敗しました' };
    }

    return { success: true, cases: data || [] };
  } catch (error) {
    console.error('fetchCasesForScorePrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'エラーが発生しました',
    };
  }
}

// 回答からスコアを予測
export async function submitAnswerForScorePrediction(params: {
  caseId: string;
  question: 'problem' | 'solution';
  answerText: string;
}): Promise<{
  success: boolean;
  prediction?: ScorePrediction;
  error?: string;
}> {
  try {
    const { caseId, question, answerText } = params;

    // バリデーション
    if (!caseId || !answerText.trim()) {
      return { success: false, error: 'ケースIDと回答テキストは必須です' };
    }

    if (answerText.trim().length < 10) {
      return { success: false, error: '回答は10文字以上入力してください' };
    }

    // 認証チェック
    const token = await getAnyAccessToken();
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    // スコア予測を実行
    const prediction = await predictScoreFromAnswer({
      token,
      caseId,
      question,
      answerText: answerText.trim(),
      topK: 10,
    });

    return { success: true, prediction };
  } catch (error) {
    console.error('submitAnswerForScorePrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スコア予測に失敗しました',
    };
  }
}
