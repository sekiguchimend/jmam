// スコア関連ユーティリティ
// スコア帯（例: 3.5点帯）を0.5刻みで扱う

import { embedText } from '@/lib/gemini/embeddings';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';

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
  question: 'problem' | 'solution';
  answerText: string;
  topK?: number;
}): Promise<ScorePrediction> {
  const { token, caseId, question, answerText, topK = 10 } = params;

  // 1. 回答テキストをembedding化
  const embeddingResult = await embedText(answerText);
  const embedding = embeddingResult.values;

  // 2. Supabaseクライアントを作成
  const supabase = createAuthedAnonServerClient(token);

  // 3. 類似回答を検索
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

  // 6. 上位3件の類似例を抽出
  const similarExamples: SimilarResponse[] = data.slice(0, 3).map((r: any) => ({
    responseId: r.response_id,
    score: Math.round(r.score * 10) / 10,
    similarity: Math.round(r.similarity * 100) / 100,
    excerpt: r.answer_text ? r.answer_text.substring(0, 100) + '...' : '(回答なし)',
  }));

  // 7. 説明文を生成
  const explanation = generateExplanation(predictedScore, similarExamples, confidence);

  return {
    predictedScore: Math.round(predictedScore * 10) / 10,
    confidence: Math.round(confidence * 100) / 100,
    similarExamples,
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


