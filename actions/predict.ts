// 予測機能のServer Actions
// FR-03: 入力されたスコアに基づき類似解答者を検索しLLMが予測解答を生成
// PE-01: 予測応答時間5秒以内

'use server';

import {
  findSimilarResponsesByEuclidean,
  getCases,
  getCaseById
} from '@/lib/supabase';
import { generatePredictionFromSimilar, generateFreeFormAnswer } from '@/lib/gemini';
import type { Scores, PredictionResponse, Case, Response, PersonalityTraits, FreeQuestionResponse } from '@/types';
import { hasAccessToken, hasUserAccessToken } from '@/lib/supabase/server';
import { recordUserScores } from '@/actions/userScore';
import { savePredictionHistoryAnswer } from '@/actions/predictionHistory';

async function ensureAuthenticated(): Promise<boolean> {
  // 管理者 or 一般のいずれかのトークンがあればOK
  const [admin, user] = await Promise.all([hasAccessToken(), hasUserAccessToken()]);
  return admin || user;
}

// ケース一覧を取得（サーバーコンポーネントから呼び出し）
export async function fetchCases(): Promise<Case[]> {
  try {
    if (!(await ensureAuthenticated())) return [];
    return await getCases();
  } catch (error) {
    console.error('fetchCases error:', error);
    return [];
  }
}

// 特定のケースを取得
export async function fetchCaseById(caseId: string): Promise<Case | null> {
  try {
    if (!(await ensureAuthenticated())) return null;
    return await getCaseById(caseId);
  } catch (error) {
    console.error('fetchCaseById error:', error);
    return null;
  }
}

// スコアに基づいて解答を予測（6指標ユークリッド距離で類似解答者を検索）
export async function predictAnswer(
  caseId: string,
  scores: Scores,
  personalityTraits?: PersonalityTraits
): Promise<{ success: true; data: PredictionResponse } | { success: false; error: string }> {
  try {
    if (!(await ensureAuthenticated())) {
      return { success: false, error: 'ログインが必要です' };
    }

    // 1. ケースのシチュエーション情報を取得
    const targetCase = await getCaseById(caseId);
    if (!targetCase) {
      return { success: false, error: '指定されたケースが見つかりません' };
    }
    const situationText = targetCase.situation_text ?? '';

    // 2. 6指標のユークリッド距離で類似解答者を検索
    const similarResults = await findSimilarResponsesByEuclidean(caseId, scores, 5);
    if (similarResults.length === 0) {
      return { success: false, error: '参考となる解答データが見つかりません' };
    }

    const similarResponses = similarResults.map((r) => r.response);

    // 3. LLMで予測解答を生成（類似解答者の解答をfew-shotとして使用）
    const prediction = await generatePredictionFromSimilar(
      situationText,
      similarResponses,
      scores,
      personalityTraits
    );

    // 4. スコア履歴を保存（失敗しても予測は成功扱い）
    await recordUserScores({ caseId, scores });

    // 5. 解答予測履歴を保存（失敗してもエラーにはしない）
    savePredictionHistoryAnswer({
      caseId,
      caseName: targetCase.case_name ?? null,
      inputScores: scores,
      resultQ1: prediction.q1Answer,
      resultQ2: prediction.q2Answer,
    }).catch((err) => {
      console.error('Failed to save answer prediction history:', err);
    });

    return {
      success: true,
      data: {
        ...prediction,
        similarResponses,
      }
    };
  } catch (error) {
    console.error('predictAnswer error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '予測処理中にエラーが発生しました'
    };
  }
}

// 自由形式のマネジメント相談に解答（エンベディング検索なし）
export async function predictFreeQuestion(
  question: string,
  scores: Scores,
  personalityTraits?: PersonalityTraits
): Promise<{ success: true; data: FreeQuestionResponse } | { success: false; error: string }> {
  try {
    if (!(await ensureAuthenticated())) {
      return { success: false, error: 'ログインが必要です' };
    }

    if (!question || question.trim().length === 0) {
      return { success: false, error: '質問を入力してください' };
    }

    if (question.trim().length < 10) {
      return { success: false, error: '質問は10文字以上で入力してください' };
    }

    // エンベディング検索なしで直接AIに質問を送信
    const response = await generateFreeFormAnswer(question, scores, personalityTraits);

    return {
      success: true,
      data: {
        answer: response.answer,
        reasoning: response.reasoning,
        suggestions: response.suggestions,
      }
    };
  } catch (error) {
    console.error('predictFreeQuestion error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : '解答生成中にエラーが発生しました'
    };
  }
}
