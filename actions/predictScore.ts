// 解答からスコアを予測するServer Actions

'use server';

import { getAnyAccessToken } from '@/lib/supabase/server';
import { predictScoreFromAnswer, type ScorePrediction } from '@/lib/scoring';
import { supabaseAnonServer } from '@/lib/supabase/anon-server';
import { stripControlChars, truncateString } from '@/lib/security';

// 入力テキストの最大長
const MAX_ANSWER_LENGTH = 20000;

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

// 解答からスコアを予測
export async function submitAnswerForScorePrediction(params: {
  caseId: string;
  question: 'q1' | 'q2';
  answerText: string;
}): Promise<{
  success: boolean;
  prediction?: ScorePrediction;
  error?: string;
}> {
  try {
    const { caseId, question, answerText } = params;

    // XSS対策: 制御文字除去と長さ制限
    const sanitizedCaseId = truncateString(stripControlChars(caseId), 100);
    const sanitizedAnswer = truncateString(stripControlChars(answerText), MAX_ANSWER_LENGTH);

    // バリデーション
    if (!sanitizedCaseId || !sanitizedAnswer.trim()) {
      return { success: false, error: 'ケースIDと解答テキストは必須です' };
    }

    if (sanitizedAnswer.trim().length < 10) {
      return { success: false, error: '解答は10文字以上入力してください' };
    }

    // 認証チェック
    const token = await getAnyAccessToken();
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    // スコア予測を実行
    const prediction = await predictScoreFromAnswer({
      token,
      caseId: sanitizedCaseId,
      question,
      answerText: sanitizedAnswer.trim(),
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
