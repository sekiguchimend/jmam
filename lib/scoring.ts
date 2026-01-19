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

// 類似回答の型定義
export type SimilarResponse = {
  responseId: string;
  score: number;
  similarity: number;
  excerpt: string;
  // コメントフィールド（AI評価用）
  commentProblem?: string | null;
  commentSolution?: string | null;
  commentOverall?: string | null;
};

// スコア予測結果の型定義
export type ScorePrediction = {
  predictedScore: number;
  confidence: number;
  similarExamples: SimilarResponse[];
  explanation: string;
};

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

  // 3. 類似回答を検索（コメント付き）
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

  // 4. 重み付き平均でスコアを算出
  const totalSimilarity = data.reduce((sum: number, r: any) => sum + r.similarity, 0);
  const weightedScore = data.reduce(
    (sum: number, r: any) => sum + (r.score * r.similarity),
    0
  );
  const predictedScore = weightedScore / totalSimilarity;

  // 5. 信頼度を計算（平均類似度）
  const avgSimilarity = totalSimilarity / data.length;
  const confidence = Math.min(1.0, avgSimilarity);

  // 6. 類似例を抽出（コメント含む）
  const similarExamples: SimilarResponse[] = data.slice(0, 5).map((r: any) => ({
    responseId: r.response_id,
    score: Math.round(r.score * 10) / 10,
    similarity: Math.round(r.similarity * 100) / 100,
    excerpt: r.answer_text ? r.answer_text.substring(0, 100) + '...' : '(回答なし)',
    commentProblem: r.comment_problem,
    commentSolution: r.comment_solution,
    commentOverall: r.comment_overall,
  }));

  const roundedScore = Math.round(predictedScore * 10) / 10;
  const roundedConfidence = Math.round(confidence * 100) / 100;

  // 7. 説明文を生成（AI or フォールバック）
  let explanation: string;
  if (useAIExplanation) {
    // AI評価用のデータを準備
    const scoringExamples: ScoringExample[] = data.slice(0, 5).map((r: any) => ({
      responseId: r.response_id,
      score: r.score,
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
      predictedScore: roundedScore,
      confidence: roundedConfidence,
    });
    explanation = aiResult.explanation;
  } else {
    explanation = generateExplanation(roundedScore, similarExamples, roundedConfidence);
  }

  return {
    predictedScore: roundedScore,
    confidence: roundedConfidence,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
  };
}

// 予測結果の説明文を生成
function generateExplanation(
  score: number,
  examples: SimilarResponse[],
  confidence: number
): string {
  const avgScore = examples.reduce((sum, ex) => sum + ex.score, 0) / examples.length;
  const scoreLevel = score >= 3.5 ? '高評価' : score >= 2.5 ? '中程度' : '低評価';

  let explanation = `この回答は過去の${scoreLevel}回答（平均${avgScore.toFixed(1)}点）に類似しています。`;

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
  predictedScore: number;
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

  // 4. 類似ケースから類似回答を検索（コメント付き）
  const { data: responsesData, error: responsesError } = await supabase.rpc('find_similar_responses_cross_cases', {
    p_embedding: JSON.stringify(answerEmbedding),
    p_case_ids: caseIds,
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

  // 5. 重み付き平均でスコアを算出
  const totalSimilarity = responsesData.reduce((sum: number, r: any) => sum + r.similarity, 0);
  const weightedScore = responsesData.reduce(
    (sum: number, r: any) => sum + (r.score * r.similarity),
    0
  );
  const predictedScore = weightedScore / totalSimilarity;

  // 6. 信頼度を計算（ケース類似度と回答類似度の組み合わせ）
  const avgCaseSimilarity = similarCases.reduce((sum, c) => sum + c.similarity, 0) / similarCases.length;
  const avgResponseSimilarity = totalSimilarity / responsesData.length;
  const confidence = Math.min(1.0, (avgCaseSimilarity + avgResponseSimilarity) / 2);

  // 7. 類似例を抽出（コメント含む）
  const similarExamples: SimilarResponse[] = responsesData.slice(0, 5).map((r: any) => ({
    responseId: r.response_id,
    score: Math.round(r.score * 10) / 10,
    similarity: Math.round(r.similarity * 100) / 100,
    excerpt: r.answer_text ? r.answer_text.substring(0, 100) + '...' : '(回答なし)',
    commentProblem: r.comment_problem,
    commentSolution: r.comment_solution,
    commentOverall: r.comment_overall,
  }));

  const roundedScore = Math.round(predictedScore * 10) / 10;
  const roundedConfidence = Math.round(confidence * 100) / 100;

  // 8. 説明文を生成（AI or フォールバック）
  let explanation: string;
  if (useAIExplanation) {
    // AI評価用のデータを準備
    const scoringExamples: ScoringExample[] = responsesData.slice(0, 5).map((r: any) => ({
      responseId: r.response_id,
      score: r.score,
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
      predictedScore: roundedScore,
      confidence: roundedConfidence,
    });
    explanation = aiResult.explanation;
  } else {
    explanation = generateNewCaseExplanation(roundedScore, similarCases, similarExamples.slice(0, 3), roundedConfidence);
  }

  return {
    predictedScore: roundedScore,
    confidence: roundedConfidence,
    similarCases,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
  };
}

// 未知ケース用の説明文を生成
function generateNewCaseExplanation(
  score: number,
  similarCases: SimilarCase[],
  examples: SimilarResponse[],
  confidence: number
): string {
  const avgScore = examples.reduce((sum, ex) => sum + ex.score, 0) / examples.length;
  const scoreLevel = score >= 3.5 ? '高評価' : score >= 2.5 ? '中程度' : '低評価';
  const topCase = similarCases[0];

  let explanation = `入力されたシチュエーションは「${topCase.caseName || topCase.caseId}」（類似度${(topCase.similarity * 100).toFixed(0)}%）に最も類似しています。`;
  explanation += ` この回答は類似ケースの${scoreLevel}回答（平均${avgScore.toFixed(1)}点）に近い内容です。`;

  if (confidence >= 0.7) {
    explanation += ' ケースと回答の両方で高い類似度が得られたため、信頼性の高い予測です。';
  } else if (confidence >= 0.5) {
    explanation += ' 中程度の信頼度です。';
  } else {
    explanation += ' 類似度がやや低いため、参考程度としてください。';
  }

  return explanation;
}


