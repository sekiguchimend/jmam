// スコア予測Server Actions（既存ケース/新規ケース両対応）

'use server';

import { getAnyAccessToken } from '@/lib/supabase/server';
import { predictScoreForNewCase, predictScoreFromAnswer, type NewCaseScorePrediction, type ScoreItems } from '@/lib/scoring';

// 統合予測結果の型
export type CombinedPredictionResult = {
  predictedScores: ScoreItems;
  embeddingScores?: ScoreItems;  // エンベディングベースの参考スコア
  confidence: number;
  q1Explanation: string;
  q2Explanation: string;
  combinedExplanation: string;
  isNewCase?: boolean;  // 新規ケースかどうか
};

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
      predictedScores: result.predictedScores,
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

// 設問1と設問2の両方から統合してスコアを予測（既存ケース用）
export async function submitCombinedPrediction(params: {
  caseId: string;
  q1Answer: string;
  q2Answer: string;
}): Promise<{
  success: boolean;
  result?: CombinedPredictionResult;
  error?: string;
}> {
  try {
    const { caseId, q1Answer, q2Answer } = params;

    // バリデーション
    if (!caseId) {
      return { success: false, error: 'ケースを選択してください' };
    }

    if (!q1Answer.trim()) {
      return { success: false, error: '設問1の回答を入力してください' };
    }

    if (q1Answer.trim().length < 10) {
      return { success: false, error: '設問1の回答は10文字以上入力してください' };
    }

    if (!q2Answer.trim()) {
      return { success: false, error: '設問2の回答を入力してください' };
    }

    if (q2Answer.trim().length < 10) {
      return { success: false, error: '設問2の回答は10文字以上入力してください' };
    }

    // 認証チェック
    const token = await getAnyAccessToken();
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    // 設問1と設問2を並列で予測
    const [q1Result, q2Result] = await Promise.all([
      predictScoreFromAnswer({
        token,
        caseId,
        question: 'q1',
        answerText: q1Answer.trim(),
        topK: 10,
      }),
      predictScoreFromAnswer({
        token,
        caseId,
        question: 'q2',
        answerText: q2Answer.trim(),
        topK: 10,
      }),
    ]);

    // スコアを統合
    // 設問1から: 問題把握 + 問題把握の詳細スコア
    // 設問2から: 対策立案、主導、連携、育成 + それぞれの詳細スコア
    const predictedScores: ScoreItems = {
      // 主要スコア
      problem: q1Result.predictedScores.problem,
      solution: q2Result.predictedScores.solution,
      role: q1Result.predictedScores.role ?? q2Result.predictedScores.role ?? null,
      leadership: q2Result.predictedScores.leadership,
      collaboration: q2Result.predictedScores.collaboration,
      development: q2Result.predictedScores.development,
      // 問題把握の詳細スコア（設問1から）
      problemUnderstanding: q1Result.predictedScores.problemUnderstanding,
      problemEssence: q1Result.predictedScores.problemEssence,
      problemMaintenanceBiz: q1Result.predictedScores.problemMaintenanceBiz,
      problemMaintenanceHr: q1Result.predictedScores.problemMaintenanceHr,
      problemReformBiz: q1Result.predictedScores.problemReformBiz,
      problemReformHr: q1Result.predictedScores.problemReformHr,
      // 対策立案の詳細スコア（設問2から）
      solutionCoverage: q2Result.predictedScores.solutionCoverage,
      solutionPlanning: q2Result.predictedScores.solutionPlanning,
      solutionMaintenanceBiz: q2Result.predictedScores.solutionMaintenanceBiz,
      solutionMaintenanceHr: q2Result.predictedScores.solutionMaintenanceHr,
      solutionReformBiz: q2Result.predictedScores.solutionReformBiz,
      solutionReformHr: q2Result.predictedScores.solutionReformHr,
      // 連携の詳細スコア（設問2から）
      collabSupervisor: q2Result.predictedScores.collabSupervisor,
      collabExternal: q2Result.predictedScores.collabExternal,
      collabMember: q2Result.predictedScores.collabMember,
    };

    // エンベディングベースのスコアを統合（参考値）
    const embeddingScores: ScoreItems | undefined = (q1Result.embeddingScores || q2Result.embeddingScores)
      ? {
          problem: q1Result.embeddingScores?.problem ?? null,
          solution: q2Result.embeddingScores?.solution ?? null,
          role: q1Result.embeddingScores?.role ?? q2Result.embeddingScores?.role ?? null,
          leadership: q2Result.embeddingScores?.leadership ?? null,
          collaboration: q2Result.embeddingScores?.collaboration ?? null,
          development: q2Result.embeddingScores?.development ?? null,
        }
      : undefined;

    // 信頼度は両方の平均
    const confidence = Math.round(((q1Result.confidence + q2Result.confidence) / 2) * 100) / 100;

    // 説明文を統合
    const combinedExplanation = `【問題把握（設問1）】\n${q1Result.explanation}\n\n【対策立案・主導・連携・育成（設問2）】\n${q2Result.explanation}`;

    return {
      success: true,
      result: {
        predictedScores,
        embeddingScores,
        confidence,
        q1Explanation: q1Result.explanation,
        q2Explanation: q2Result.explanation,
        combinedExplanation,
        isNewCase: false,
      },
    };
  } catch (error) {
    console.error('submitCombinedPrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スコア予測に失敗しました',
    };
  }
}

// 設問1と設問2の両方から統合してスコアを予測（新規ケース用）
export async function submitCombinedNewCasePrediction(params: {
  situationText: string;
  q1Answer: string;
  q2Answer: string;
}): Promise<{
  success: boolean;
  result?: CombinedPredictionResult;
  error?: string;
}> {
  try {
    const { situationText, q1Answer, q2Answer } = params;

    // バリデーション
    if (!situationText.trim()) {
      return { success: false, error: 'ケース内容（シチュエーション）を入力してください' };
    }

    if (situationText.trim().length < 20) {
      return { success: false, error: 'ケース内容は20文字以上入力してください' };
    }

    if (!q1Answer.trim()) {
      return { success: false, error: '設問1の回答を入力してください' };
    }

    if (q1Answer.trim().length < 10) {
      return { success: false, error: '設問1の回答は10文字以上入力してください' };
    }

    if (!q2Answer.trim()) {
      return { success: false, error: '設問2の回答を入力してください' };
    }

    if (q2Answer.trim().length < 10) {
      return { success: false, error: '設問2の回答は10文字以上入力してください' };
    }

    // 認証チェック
    const token = await getAnyAccessToken();
    if (!token) {
      return { success: false, error: '認証が必要です' };
    }

    // 設問1と設問2を並列で予測
    const [q1Result, q2Result] = await Promise.all([
      predictScoreForNewCase({
        token,
        situationText: situationText.trim(),
        question: 'q1',
        answerText: q1Answer.trim(),
        topKCases: 5,
        topKResponses: 10,
      }),
      predictScoreForNewCase({
        token,
        situationText: situationText.trim(),
        question: 'q2',
        answerText: q2Answer.trim(),
        topKCases: 5,
        topKResponses: 10,
      }),
    ]);

    // スコアを統合（新規ケース）
    const predictedScores: ScoreItems = {
      // 主要スコア
      problem: q1Result.predictedScores.problem,
      solution: q2Result.predictedScores.solution,
      role: q1Result.predictedScores.role ?? q2Result.predictedScores.role ?? null,
      leadership: q2Result.predictedScores.leadership,
      collaboration: q2Result.predictedScores.collaboration,
      development: q2Result.predictedScores.development,
      // 問題把握の詳細スコア（設問1から）
      problemUnderstanding: q1Result.predictedScores.problemUnderstanding,
      problemEssence: q1Result.predictedScores.problemEssence,
      problemMaintenanceBiz: q1Result.predictedScores.problemMaintenanceBiz,
      problemMaintenanceHr: q1Result.predictedScores.problemMaintenanceHr,
      problemReformBiz: q1Result.predictedScores.problemReformBiz,
      problemReformHr: q1Result.predictedScores.problemReformHr,
      // 対策立案の詳細スコア（設問2から）
      solutionCoverage: q2Result.predictedScores.solutionCoverage,
      solutionPlanning: q2Result.predictedScores.solutionPlanning,
      solutionMaintenanceBiz: q2Result.predictedScores.solutionMaintenanceBiz,
      solutionMaintenanceHr: q2Result.predictedScores.solutionMaintenanceHr,
      solutionReformBiz: q2Result.predictedScores.solutionReformBiz,
      solutionReformHr: q2Result.predictedScores.solutionReformHr,
      // 連携の詳細スコア（設問2から）
      collabSupervisor: q2Result.predictedScores.collabSupervisor,
      collabExternal: q2Result.predictedScores.collabExternal,
      collabMember: q2Result.predictedScores.collabMember,
    };

    // エンベディングベースのスコアを統合（参考値）
    const embeddingScores: ScoreItems | undefined = (q1Result.embeddingScores || q2Result.embeddingScores)
      ? {
          problem: q1Result.embeddingScores?.problem ?? null,
          solution: q2Result.embeddingScores?.solution ?? null,
          role: q1Result.embeddingScores?.role ?? q2Result.embeddingScores?.role ?? null,
          leadership: q2Result.embeddingScores?.leadership ?? null,
          collaboration: q2Result.embeddingScores?.collaboration ?? null,
          development: q2Result.embeddingScores?.development ?? null,
        }
      : undefined;

    // 信頼度は両方の平均
    const confidence = Math.round(((q1Result.confidence + q2Result.confidence) / 2) * 100) / 100;

    // 説明文を統合
    const combinedExplanation = `【問題把握（設問1）】\n${q1Result.explanation}\n\n【対策立案・主導・連携・育成（設問2）】\n${q2Result.explanation}`;

    return {
      success: true,
      result: {
        predictedScores,
        embeddingScores,
        confidence,
        q1Explanation: q1Result.explanation,
        q2Explanation: q2Result.explanation,
        combinedExplanation,
        isNewCase: true,
      },
    };
  } catch (error) {
    console.error('submitCombinedNewCasePrediction error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'スコア予測に失敗しました',
    };
  }
}

