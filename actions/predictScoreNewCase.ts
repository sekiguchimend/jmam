// スコア予測Server Actions（既存ケース/新規ケース両対応）

'use server';

import { getAnyAccessToken } from '@/lib/supabase/server';
import { predictScoreForNewCase, predictScoreFromAnswer, type NewCaseScorePrediction } from '@/lib/scoring';

// 未知ケースの回答からスコアを予測
export async function submitAnswerForNewCasePrediction(params: {
  situationText: string;
  question: 'q1' | 'q2';
  answerText: string;
}): Promise<{
  success: boolean;
  prediction?: NewCaseScorePrediction;
  error?: string;
}> {
  try {
    const { situationText, question, answerText } = params;

    // バリデーション
    if (!situationText.trim()) {
      return { success: false, error: 'ケース内容（シチュエーション）を入力してください' };
    }

    if (situationText.trim().length < 20) {
      return { success: false, error: 'ケース内容は20文字以上入力してください' };
    }

    if (!answerText.trim()) {
      return { success: false, error: '回答テキストを入力してください' };
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
    const prediction = await predictScoreForNewCase({
      token,
      situationText: situationText.trim(),
      question,
      answerText: answerText.trim(),
      topKCases: 5,
      topKResponses: 10,
    });

    return { success: true, prediction };
  } catch (error) {
    console.error('submitAnswerForNewCasePrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スコア予測に失敗しました',
    };
  }
}

// 既存ケースの回答からスコアを予測
export async function submitAnswerForExistingCasePrediction(params: {
  caseId: string;
  question: 'q1' | 'q2';
  answerText: string;
}): Promise<{
  success: boolean;
  prediction?: NewCaseScorePrediction;
  error?: string;
}> {
  try {
    const { caseId, question, answerText } = params;

    // バリデーション
    if (!caseId) {
      return { success: false, error: 'ケースを選択してください' };
    }

    if (!answerText.trim()) {
      return { success: false, error: '回答テキストを入力してください' };
    }

    if (answerText.trim().length < 10) {
      return { success: false, error: '回答は10文字以上入力してください' };
    }

    // 認証チェック
    const token = await getAnyAccessToken();
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    // 既存のスコア予測を実行
    const result = await predictScoreFromAnswer({
      token,
      caseId,
      question,
      answerText: answerText.trim(),
      topK: 10,
    });

    // NewCaseScorePrediction形式に変換（similarCasesは空）
    const prediction: NewCaseScorePrediction = {
      predictedScore: result.predictedScore,
      confidence: result.confidence,
      similarCases: [], // 既存ケースの場合は類似ケース検索なし
      similarExamples: result.similarExamples,
      explanation: result.explanation,
    };

    return { success: true, prediction };
  } catch (error) {
    console.error('submitAnswerForExistingCasePrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スコア予測に失敗しました',
    };
  }
}
