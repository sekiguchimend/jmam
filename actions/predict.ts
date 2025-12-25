// 予測機能のServer Actions
// FR-03: 入力されたスコアに基づき類似回答者を検索しLLMが予測回答を生成
// PE-01: 予測応答時間5秒以内

'use server';

import {
  findResponsesForRAG,
  getTypicalExamples,
  getCases,
  getCaseById
} from '@/lib/supabase';
import { generatePrediction, type FewShotContext } from '@/lib/gemini';
import type { Scores, PredictionResponse, Case, Response } from '@/types';
import { hasAccessToken, hasUserAccessToken } from '@/lib/supabase/server';
import { recordUserScores } from '@/actions/userScore';
import { toScoreBucket } from '@/lib/scoring';

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

// スコアに基づいて回答を予測
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

    // 2. 目標スコア帯の「典型例」を取得（few-shot用）
    const problemBucket = toScoreBucket(scores.problem);
    const solutionBucket = toScoreBucket(scores.solution);
    const [problemTypical, solutionTypical] = await Promise.all([
      getTypicalExamples(caseId, 'problem', problemBucket, 2),
      getTypicalExamples(caseId, 'solution', solutionBucket, 2),
    ]);

    const fewShot: FewShotContext = {
      problemScoreBucket: problemBucket,
      solutionScoreBucket: solutionBucket,
      problemExamples: problemTypical.map((t) => t.rep_text),
      solutionExamples: solutionTypical.map((t) => t.rep_text),
    };

    // 典型例が未生成の場合のフォールバック（既存RAG）
    let ragResponses: Response[] = [];
    if (fewShot.problemExamples.length === 0 || fewShot.solutionExamples.length === 0) {
      ragResponses = await findResponsesForRAG(caseId, scores, 5);
      if (ragResponses.length === 0) {
        return { success: false, error: '参考となる回答データが見つかりません（典型例も未生成です）' };
      }
      if (fewShot.problemExamples.length === 0) {
        fewShot.problemExamples = ragResponses
          .map((r) => r.answer_q1)
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .slice(0, 2);
      }
      if (fewShot.solutionExamples.length === 0) {
        fewShot.solutionExamples = ragResponses
          .map((r) => r.answer_q2)
          .filter((t): t is string => typeof t === 'string' && t.trim().length > 0)
          .slice(0, 2);
      }
    }

    // 3. LLMで予測回答を生成（典型例few-shotに沿って生成）
    const prediction = await generatePrediction(situationText, fewShot, scores);

    // 4. スコア履歴を保存（失敗しても予測は成功扱い）
    await recordUserScores({ caseId, scores });

    return {
      success: true,
      data: {
        ...prediction,
        similarResponses: ragResponses.length ? ragResponses : undefined, // フォールバック時のみ返す
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
