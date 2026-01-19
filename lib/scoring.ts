// スコア関連ユーティリティ
// スコア帯（例: 3.5点帯）を0.5刻みで扱う

import { embedText } from '@/lib/gemini/embeddings';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { generateAIExplanation, type ScoringExample, type ScoringCaseContext } from '@/lib/scoring-prompt';

export function toScoreBucket(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(5, Math.max(0, score));
  return Math.round(clamped * 2) / 2;
}

// 個別スコア項目の型定義
export type ScoreItems = {
  overall: number | null;      // 総合評点
  problem: number | null;      // 問題把握
  solution: number | null;     // 対策立案
  leadership: number | null;   // 主導
  collaboration: number | null; // 連携
  development: number | null;  // 育成
};

// 類似回答の型定義
export type SimilarResponse = {
  responseId: string;
  scores: ScoreItems;
  similarity: number;
  excerpt: string;
  // コメントフィールド（AI評価用）
  commentProblem?: string | null;
  commentSolution?: string | null;
  commentOverall?: string | null;
};

// スコア予測結果の型定義
export type ScorePrediction = {
  predictedScores: ScoreItems;  // 複数スコア
  confidence: number;
  similarExamples: SimilarResponse[];
  explanation: string;
};

// 重み付き平均でスコアを計算するヘルパー関数
function calculateWeightedScore(data: any[], field: string, totalSimilarity: number): number | null {
  const validData = data.filter((r: any) => r[field] != null);
  if (validData.length === 0) return null;
  
  const weightedSum = validData.reduce(
    (sum: number, r: any) => sum + (r[field] * r.similarity),
    0
  );
  const validSimilarity = validData.reduce((sum: number, r: any) => sum + r.similarity, 0);
  return validSimilarity > 0 ? Math.round((weightedSum / validSimilarity) * 10) / 10 : null;
}

// 回答テキストからスコアを予測
export async function predictScoreFromAnswer(params: {
  token: string;
  caseId: string;
  question: 'q1' | 'q2';
  answerText: string;
  topK?: number;
  caseContext?: string; // ケースの状況説明（オプション）
  useAIExplanation?: boolean; // AI説明を使用するか（デフォルト: true）
}): Promise<ScorePrediction> {
  const { token, caseId, question, answerText, topK = 10, caseContext, useAIExplanation = true } = params;

  // 1. 回答テキストをembedding化
  const embeddingResult = await embedText(answerText);
  const embedding = embeddingResult.values;

  // 2. Supabaseクライアントを作成
  const supabase = createAuthedAnonServerClient(token);

  // 3. 類似回答を検索（全スコア付き）
  const { data, error } = await supabase.rpc('find_similar_responses_for_scoring', {
    p_embedding: JSON.stringify(embedding),
    p_case_id: caseId,
    p_question: question,
    p_limit: topK,
  });

  if (error) {
    console.error('find_similar_responses_for_scoring error:', error);
    throw new Error('類似回答の検索に失敗しました');
  }

  if (!data || data.length === 0) {
    throw new Error('類似回答が見つかりませんでした。このケースにはまだ回答データがありません。');
  }

  // 4. 各スコア項目の重み付き平均を算出
  const totalSimilarity = data.reduce((sum: number, r: any) => sum + r.similarity, 0);
  
  const predictedScores: ScoreItems = {
    overall: calculateWeightedScore(data, 'score_overall', totalSimilarity),
    problem: calculateWeightedScore(data, 'score_problem', totalSimilarity),
    solution: calculateWeightedScore(data, 'score_solution', totalSimilarity),
    leadership: calculateWeightedScore(data, 'score_leadership', totalSimilarity),
    collaboration: calculateWeightedScore(data, 'score_collaboration', totalSimilarity),
    development: calculateWeightedScore(data, 'score_development', totalSimilarity),
  };

  // 5. 信頼度を計算（平均類似度）
  const avgSimilarity = totalSimilarity / data.length;
  const confidence = Math.min(1.0, avgSimilarity);

  // 6. 類似例を抽出（全スコア含む）
  const similarExamples: SimilarResponse[] = data.slice(0, 5).map((r: any) => ({
    responseId: r.response_id,
    scores: {
      overall: r.score_overall != null ? Math.round(r.score_overall * 10) / 10 : null,
      problem: r.score_problem != null ? Math.round(r.score_problem * 10) / 10 : null,
      solution: r.score_solution != null ? Math.round(r.score_solution * 10) / 10 : null,
      leadership: r.score_leadership != null ? Math.round(r.score_leadership * 10) / 10 : null,
      collaboration: r.score_collaboration != null ? Math.round(r.score_collaboration * 10) / 10 : null,
      development: r.score_development != null ? Math.round(r.score_development * 10) / 10 : null,
    },
    similarity: Math.round(r.similarity * 100) / 100,
    excerpt: r.answer_text ? r.answer_text.substring(0, 100) + '...' : '(回答なし)',
    commentProblem: r.comment_problem,
    commentSolution: r.comment_solution,
    commentOverall: r.comment_overall,
  }));

  const roundedConfidence = Math.round(confidence * 100) / 100;

  // 7. 説明文を生成（AI or フォールバック）
  let explanation: string;
  if (useAIExplanation) {
    // AI評価用のデータを準備
    const scoringExamples: ScoringExample[] = data.slice(0, 5).map((r: any) => ({
      responseId: r.response_id,
      score: r.score_overall || r.score_problem || r.score_solution || 0,
      similarity: r.similarity,
      answerText: r.answer_text || '',
      commentProblem: r.comment_problem,
      commentSolution: r.comment_solution,
      commentOverall: r.comment_overall,
    }));

    const aiResult = await generateAIExplanation({
      caseContext: caseContext || '',
      question,
      answerText,
      similarExamples: scoringExamples,
      predictedScore: predictedScores.overall || predictedScores.problem || 0,
      confidence: roundedConfidence,
    });
    explanation = aiResult.explanation;
  } else {
    explanation = generateExplanation(predictedScores, similarExamples, roundedConfidence);
  }

  return {
    predictedScores,
    confidence: roundedConfidence,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
  };
}

// 予測結果の説明文を生成
function generateExplanation(
  scores: ScoreItems,
  examples: SimilarResponse[],
  confidence: number
): string {
  const overallScore = scores.overall || scores.problem || 0;
  const scoreLevel = overallScore >= 3.5 ? '高評価' : overallScore >= 2.5 ? '中程度' : '低評価';

  let explanation = `この回答は過去の${scoreLevel}回答に類似しています。`;

  if (confidence >= 0.8) {
    explanation += ' 信頼度が高い予測です。';
  } else if (confidence >= 0.6) {
    explanation += ' 中程度の信頼度です。';
  } else {
    explanation += ' 類似度がやや低いため、参考程度としてください。';
  }

  return explanation;
}

// ============================================
// 未知のケース（新規ケース）用のスコア予測
// ============================================

// 類似ケース情報
export type SimilarCase = {
  caseId: string;
  caseName: string | null;
  situationText: string | null;
  similarity: number;
};

// 未知ケース用の予測結果
export type NewCaseScorePrediction = {
  predictedScores: ScoreItems;  // 複数スコア
  confidence: number;
  similarCases: SimilarCase[];
  similarExamples: SimilarResponse[];
  explanation: string;
};

// 類似ケースを検索
export async function findSimilarCases(params: {
  token: string;
  situationText: string;
  topK?: number;
}): Promise<SimilarCase[]> {
  const { token, situationText, topK = 5 } = params;

  // 1. シチュエーションテキストをembedding化
  const embeddingResult = await embedText(situationText);
  const embedding = embeddingResult.values;

  // 2. Supabaseクライアントを作成
  const supabase = createAuthedAnonServerClient(token);

  // 3. 類似ケースを検索
  const { data, error } = await supabase.rpc('find_similar_cases', {
    p_embedding: JSON.stringify(embedding),
    p_limit: topK,
  });

  if (error) {
    console.error('find_similar_cases error:', error);
    throw new Error('類似ケースの検索に失敗しました');
  }

  if (!data || data.length === 0) {
    return [];
  }

  return data.map((c: any) => ({
    caseId: c.case_id,
    caseName: c.case_name,
    situationText: c.situation_text,
    similarity: Math.round(c.similarity * 100) / 100,
  }));
}

// 未知ケースからスコアを予測
export async function predictScoreForNewCase(params: {
  token: string;
  situationText: string;
  question: 'q1' | 'q2';
  answerText: string;
  topKCases?: number;
  topKResponses?: number;
  useAIExplanation?: boolean; // AI説明を使用するか（デフォルト: true）
}): Promise<NewCaseScorePrediction> {
  const { token, situationText, question, answerText, topKCases = 5, topKResponses = 10, useAIExplanation = true } = params;

  // 1. シチュエーションテキストをembedding化して類似ケースを検索
  const situationEmbeddingResult = await embedText(situationText);
  const situationEmbedding = situationEmbeddingResult.values;

  const supabase = createAuthedAnonServerClient(token);

  // 類似ケースを検索
  const { data: casesData, error: casesError } = await supabase.rpc('find_similar_cases', {
    p_embedding: JSON.stringify(situationEmbedding),
    p_limit: topKCases,
  });

  if (casesError) {
    console.error('find_similar_cases error:', casesError);
    throw new Error('類似ケースの検索に失敗しました');
  }

  if (!casesData || casesData.length === 0) {
    throw new Error('類似ケースが見つかりませんでした。ケースのシチュエーションを登録してください。');
  }

  const similarCases: SimilarCase[] = casesData.map((c: any) => ({
    caseId: c.case_id,
    caseName: c.case_name,
    situationText: c.situation_text,
    similarity: Math.round(c.similarity * 100) / 100,
  }));

  // 2. 回答テキストをembedding化
  const answerEmbeddingResult = await embedText(answerText);
  const answerEmbedding = answerEmbeddingResult.values;

  // 3. 類似ケースのIDを取得
  const caseIds = similarCases.map((c) => c.caseId);

  // 4. 類似ケースから類似回答を検索（全スコア付き）
  const { data: responsesData, error: responsesError } = await supabase.rpc('find_similar_responses_cross_cases', {
    p_embedding: JSON.stringify(answerEmbedding),
    p_question: question,
    p_limit: topKResponses,
  });

  if (responsesError) {
    console.error('find_similar_responses_cross_cases error:', responsesError);
    throw new Error('類似回答の検索に失敗しました');
  }

  if (!responsesData || responsesData.length === 0) {
    throw new Error('類似回答が見つかりませんでした。類似ケースにはまだ回答データがありません。');
  }

  // 5. 各スコア項目の重み付き平均を算出
  const totalSimilarity = responsesData.reduce((sum: number, r: any) => sum + r.similarity, 0);

  const predictedScores: ScoreItems = {
    overall: calculateWeightedScore(responsesData, 'score_overall', totalSimilarity),
    problem: calculateWeightedScore(responsesData, 'score_problem', totalSimilarity),
    solution: calculateWeightedScore(responsesData, 'score_solution', totalSimilarity),
    leadership: calculateWeightedScore(responsesData, 'score_leadership', totalSimilarity),
    collaboration: calculateWeightedScore(responsesData, 'score_collaboration', totalSimilarity),
    development: calculateWeightedScore(responsesData, 'score_development', totalSimilarity),
  };

  // 6. 信頼度を計算（ケース類似度と回答類似度の組み合わせ）
  const avgCaseSimilarity = similarCases.reduce((sum, c) => sum + c.similarity, 0) / similarCases.length;
  const avgResponseSimilarity = totalSimilarity / responsesData.length;
  const confidence = Math.min(1.0, (avgCaseSimilarity + avgResponseSimilarity) / 2);

  // 7. 類似例を抽出（全スコア含む）
  const similarExamples: SimilarResponse[] = responsesData.slice(0, 5).map((r: any) => ({
    responseId: r.response_id,
    scores: {
      overall: r.score_overall != null ? Math.round(r.score_overall * 10) / 10 : null,
      problem: r.score_problem != null ? Math.round(r.score_problem * 10) / 10 : null,
      solution: r.score_solution != null ? Math.round(r.score_solution * 10) / 10 : null,
      leadership: r.score_leadership != null ? Math.round(r.score_leadership * 10) / 10 : null,
      collaboration: r.score_collaboration != null ? Math.round(r.score_collaboration * 10) / 10 : null,
      development: r.score_development != null ? Math.round(r.score_development * 10) / 10 : null,
    },
    similarity: Math.round(r.similarity * 100) / 100,
    excerpt: r.answer_text ? r.answer_text.substring(0, 100) + '...' : '(回答なし)',
    commentProblem: r.comment_problem,
    commentSolution: r.comment_solution,
    commentOverall: r.comment_overall,
  }));

  const roundedConfidence = Math.round(confidence * 100) / 100;

  // 8. 説明文を生成（AI or フォールバック）
  let explanation: string;
  if (useAIExplanation) {
    // AI評価用のデータを準備
    const scoringExamples: ScoringExample[] = responsesData.slice(0, 5).map((r: any) => ({
      responseId: r.response_id,
      score: r.score_overall || r.score_problem || r.score_solution || 0,
      similarity: r.similarity,
      answerText: r.answer_text || '',
      commentProblem: r.comment_problem,
      commentSolution: r.comment_solution,
      commentOverall: r.comment_overall,
    }));

    const scoringCases: ScoringCaseContext[] = similarCases.map((c) => ({
      caseId: c.caseId,
      caseName: c.caseName,
      situationText: c.situationText,
      similarity: c.similarity,
    }));

    const aiResult = await generateAIExplanation({
      caseContext: situationText,
      question,
      answerText,
      similarExamples: scoringExamples,
      similarCases: scoringCases,
      predictedScore: predictedScores.overall || predictedScores.problem || 0,
      confidence: roundedConfidence,
    });
    explanation = aiResult.explanation;
  } else {
    explanation = generateNewCaseExplanation(predictedScores, similarCases, similarExamples.slice(0, 3), roundedConfidence);
  }

  return {
    predictedScores,
    confidence: roundedConfidence,
    similarCases,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
  };
}

// 未知ケース用の説明文を生成
function generateNewCaseExplanation(
  scores: ScoreItems,
  similarCases: SimilarCase[],
  examples: SimilarResponse[],
  confidence: number
): string {
  const overallScore = scores.overall || scores.problem || 0;
  const scoreLevel = overallScore >= 3.5 ? '高評価' : overallScore >= 2.5 ? '中程度' : '低評価';
  const topCase = similarCases[0];

  let explanation = `入力されたシチュエーションは「${topCase.caseName || topCase.caseId}」（類似度${(topCase.similarity * 100).toFixed(0)}%）に最も類似しています。`;
  explanation += ` この回答は類似ケースの${scoreLevel}回答に近い内容です。`;

  if (confidence >= 0.7) {
    explanation += ' ケースと回答の両方で高い類似度が得られたため、信頼性の高い予測です。';
  } else if (confidence >= 0.5) {
    explanation += ' 中程度の信頼度です。';
  } else {
    explanation += ' 類似度がやや低いため、参考程度としてください。';
  }

  return explanation;
}


