// 予測機能のServer Actions
// FR-03: 入力されたスコアに基づき類似回答者を検索しLLMが予測回答を生成
// PE-01: 予測応答時間5秒以内

'use server';

import {
  findSimilarResponsesByEuclidean,
  getCases,
  getCaseById
} from '@/lib/supabase';
import { generatePredictionFromSimilar } from '@/lib/gemini';
import type { Scores, PredictionResponse, Case, Response } from '@/types';
import { hasAccessToken, hasUserAccessToken } from '@/lib/supabase/server';
import { recordUserScores } from '@/actions/userScore';

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

// スコアに基づいて回答を予測（6指標ユークリッド距離で類似回答者を検索）
export async function predictAnswer(
  caseId: string,
  scores: Scores
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

    // 2. 6指標のユークリッド距離で類似回答者を検索
    const similarResults = await findSimilarResponsesByEuclidean(caseId, scores, 5);
    if (similarResults.length === 0) {
      return { success: false, error: '参考となる回答データが見つかりません' };
    }

    const similarResponses = similarResults.map((r) => r.response);

    // 3. LLMで予測回答を生成（類似回答者の回答をfew-shotとして使用）
    const prediction = await generatePredictionFromSimilar(
      situationText,
      similarResponses,
      scores
    );

    // 4. スコア履歴を保存（失敗しても予測は成功扱い）
    await recordUserScores({ caseId, scores });

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
