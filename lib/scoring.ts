// スコア関連ユーティリティ
// スコア帯（例: 3.5点帯）を0.5刻みで扱う

import { embedText } from '@/lib/gemini/embeddings';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { generateAIScoring, performEarlyQualityCheck, type ScoringExample, type ScoringCaseContext, type AIScoringResponse, type EarlyQualityCheckResult } from '@/lib/scoring-prompt';

export function toScoreBucket(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(5, Math.max(0, score));
  return Math.round(clamped * 2) / 2;
}

// ハイブリッド手法用の設定
const HYBRID_CONFIG = {
  topK: 100,              // 多めに取得
  maxPerBucket: 5,        // 各スコア帯から最大5個
  minSimilarity: 0.5,     // 類似度の最低閾値（50%以上）
  highConfidenceSimilarity: 0.7, // 高信頼度とみなす類似度（70%以上）
  similarityPower: 2,     // 類似度の重み付け指数（2乗すると高類似度が強調される）
};

// Prototypical Networks用の設定
const PROTOTYPE_CONFIG = {
  usePrototypes: true,              // プロトタイプベースの予測を使用するか
  prototypeWeight: 0.6,             // プロトタイプ予測の重み（0.6 = 60%）
  individualWeight: 0.4,            // 個別類似回答の重み（0.4 = 40%）
  minPrototypeSimilarity: 0.4,      // プロトタイプとの最低類似度閾値
  temperatureScaling: 2.0,          // Softmax温度パラメータ（低いほど最高スコアを強調）
};

// AI統合評価の設定
const AI_SCORING_CONFIG = {
  enabled: true,                    // AI統合評価を有効にするか
  invalidAnswerScore: 1.0,          // 無効な回答の場合の固定スコア
};

// 平滑化逆頻度重み計算
function calculateClassWeight(count: number): number {
  return 1 / Math.sqrt(Math.max(count, 1));
}

// Softmax関数（温度パラメータ付き）
function softmax(values: number[], temperature: number = 1.0): number[] {
  // 温度でスケーリング
  const scaledValues = values.map(v => v / temperature);

  // 数値安定性のため最大値を引く
  const maxVal = Math.max(...scaledValues);
  const expValues = scaledValues.map(v => Math.exp(v - maxVal));
  const sumExp = expValues.reduce((a, b) => a + b, 0);

  return expValues.map(v => v / sumExp);
}

// プロトタイプ情報の型定義
type PrototypeInfo = {
  scoreBucket: number;
  similarity: number;
  sampleCount: number;
};

// プロトタイプベースのスコア予測
async function predictScoreWithPrototypes(
  supabase: any,
  caseId: string,
  question: string,
  embedding: number[],
  scoreField: string
): Promise<number | null> {
  // プロトタイプとの類似度を取得
  const { data, error } = await supabase.rpc('predict_score_with_prototypes', {
    p_embedding: JSON.stringify(embedding),
    p_case_id: caseId,
    p_question: question,
    p_score_field: scoreField,
  });

  if (error) {
    console.error('predict_score_with_prototypes error:', error);
    return null;
  }

  if (!data || data.length === 0) {
    return null;
  }

  const prototypes: PrototypeInfo[] = data.map((p: any) => ({
    scoreBucket: Number(p.score_bucket),
    similarity: p.similarity,
    sampleCount: p.sample_count,
  }));

  // 類似度が閾値以下のプロトタイプを除外
  const validPrototypes = prototypes.filter(
    p => p.similarity >= PROTOTYPE_CONFIG.minPrototypeSimilarity
  );

  if (validPrototypes.length === 0) {
    return null;
  }

  // Softmaxで確率分布に変換（温度パラメータで調整）
  const similarities = validPrototypes.map(p => p.similarity);
  const weights = softmax(similarities, PROTOTYPE_CONFIG.temperatureScaling);

  // 重み付き平均でスコアを計算
  let weightedSum = 0;
  let totalWeight = 0;

  validPrototypes.forEach((p, i) => {
    weightedSum += p.scoreBucket * weights[i];
    totalWeight += weights[i];
  });

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
}

// スコア分布を取得してMap化
async function getScoreDistributionMap(
  supabase: any,
  caseId: string,
  question: string,
  scoreField: string
): Promise<Map<number, number>> {
  const { data, error } = await supabase.rpc('get_score_distribution', {
    p_case_id: caseId,
    p_question: question,
    p_score_field: scoreField,
  });

  if (error) {
    console.error('getScoreDistribution error:', error);
    return new Map();
  }

  const map = new Map<number, number>();
  if (data) {
    for (const row of data) {
      map.set(Number(row.score_bucket), row.sample_count);
    }
  }
  return map;
}

// 層別サンプリング: 各スコア帯から上位maxPerBucket個を選択
function stratifiedSampling<T extends { score: number | null; similarity: number }>(
  data: T[],
  scoreField: string,
  maxPerBucket: number
): T[] {
  const grouped = new Map<number, T[]>();

  for (const item of data) {
    const score = (item as any)[scoreField];
    if (score == null) continue;
    const bucket = toScoreBucket(score);
    if (!grouped.has(bucket)) {
      grouped.set(bucket, []);
    }
    grouped.get(bucket)!.push(item);
  }

  const sampled: T[] = [];
  for (const items of grouped.values()) {
    // 各スコア帯内で類似度順にソート
    items.sort((a, b) => b.similarity - a.similarity);
    sampled.push(...items.slice(0, maxPerBucket));
  }

  return sampled;
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
  predictedScores: ScoreItems;  // 複数スコア（AI評価後）
  embeddingScores?: ScoreItems; // エンベディングベースの予測スコア（参考値）
  confidence: number;
  similarExamples: SimilarResponse[];
  explanation: string;
  isValidAnswer?: boolean;      // 有効な回答かどうか
  earlyCheckResult?: EarlyQualityCheckResult;  // 早期チェック結果（無効な場合のみ）
};

// ハイブリッド手法で重み付き平均を計算
// 類似度を強く反映し、低類似度の回答の影響を抑制
function calculateWeightedScoreHybrid(
  data: any[],
  field: string,
  distributionMap: Map<number, number>
): number | null {
  const validData = data.filter((r: any) => r[field] != null);
  if (validData.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const r of validData) {
    const score = r[field];
    const similarity = r.similarity;
    const bucket = toScoreBucket(score);

    // 平滑化逆頻度重み（影響を抑制: sqrt → cbrt）
    const count = distributionMap.get(bucket) || 1;
    const classWeight = 1 / Math.cbrt(Math.max(count, 1)); // 3乗根に変更して影響を弱める

    // 類似度を強調（2乗することで高類似度ほど重みが大きくなる）
    const similarityWeight = Math.pow(similarity, HYBRID_CONFIG.similarityPower);

    // 最終重み = 類似度^2 × クラス重み
    // 類似度が主役、クラス重みは補助
    const finalWeight = similarityWeight * classWeight;

    weightedSum += score * finalWeight;
    totalWeight += finalWeight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
}

// 回答テキストからスコアを予測（ハイブリッド手法対応）
export async function predictScoreFromAnswer(params: {
  token: string;
  caseId: string;
  question: 'q1' | 'q2';
  answerText: string;
  topK?: number;
  caseContext?: string; // ケースの状況説明（オプション）
  useAIExplanation?: boolean; // AI説明を使用するか（デフォルト: true）
  useHybridMethod?: boolean; // ハイブリッド手法を使用するか（デフォルト: true）
}): Promise<ScorePrediction> {
  const {
    token,
    caseId,
    question,
    answerText,
    topK = HYBRID_CONFIG.topK,
    caseContext,
    useAIExplanation = true,
    useHybridMethod = true,
  } = params;

  // 1. 回答テキストをembedding化
  const embeddingResult = await embedText(answerText);
  const embedding = embeddingResult.values;

  // 2. Supabaseクライアントを作成
  const supabase = createAuthedAnonServerClient(token);

  // 3. 類似回答を検索（全スコア付き、多めに取得）
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

  // フィルタリング: 類似度が低すぎるものを除外
  const filteredData = data.filter((r: any) => r.similarity >= HYBRID_CONFIG.minSimilarity);

  if (filteredData.length === 0) {
    throw new Error('類似度が十分に高い回答が見つかりませんでした。');
  }

  let predictedScores: ScoreItems;

  if (useHybridMethod && PROTOTYPE_CONFIG.usePrototypes) {
    // 4a. Prototypical Networks + 個別類似回答のハイブリッド手法

    // プロトタイプベースの予測を並列で取得
    const [
      prototypeOverall,
      prototypeProblem,
      prototypeSolution,
      prototypeLeadership,
      prototypeCollaboration,
      prototypeDevelopment,
    ] = await Promise.all([
      predictScoreWithPrototypes(supabase, caseId, question, embedding, 'overall'),
      predictScoreWithPrototypes(supabase, caseId, question, embedding, 'problem'),
      predictScoreWithPrototypes(supabase, caseId, question, embedding, 'solution'),
      predictScoreWithPrototypes(supabase, caseId, question, embedding, 'leadership'),
      predictScoreWithPrototypes(supabase, caseId, question, embedding, 'collaboration'),
      predictScoreWithPrototypes(supabase, caseId, question, embedding, 'development'),
    ]);

    // 個別類似回答からの予測（従来の単純な重み付き平均）
    const calculateSimpleWeightedScore = (data: any[], field: string): number | null => {
      const validData = data.filter((r: any) => r[field] != null);
      if (validData.length === 0) return null;

      // 類似度を2乗して重みを計算
      let weightedSum = 0;
      let totalWeight = 0;

      for (const r of validData) {
        const score = r[field];
        const similarity = r.similarity;
        const weight = Math.pow(similarity, HYBRID_CONFIG.similarityPower);

        weightedSum += score * weight;
        totalWeight += weight;
      }

      return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
    };

    const individualOverall = calculateSimpleWeightedScore(filteredData, 'score_overall');
    const individualProblem = calculateSimpleWeightedScore(filteredData, 'score_problem');
    const individualSolution = calculateSimpleWeightedScore(filteredData, 'score_solution');
    const individualLeadership = calculateSimpleWeightedScore(filteredData, 'score_leadership');
    const individualCollaboration = calculateSimpleWeightedScore(filteredData, 'score_collaboration');
    const individualDevelopment = calculateSimpleWeightedScore(filteredData, 'score_development');

    // プロトタイプと個別回答の予測を組み合わせる
    const combineScores = (prototype: number | null, individual: number | null): number | null => {
      if (prototype !== null && individual !== null) {
        // 両方ある場合は重み付き平均
        const combined = prototype * PROTOTYPE_CONFIG.prototypeWeight + individual * PROTOTYPE_CONFIG.individualWeight;
        return Math.round(combined * 10) / 10;
      } else if (prototype !== null) {
        // プロトタイプのみ
        return prototype;
      } else if (individual !== null) {
        // 個別のみ
        return individual;
      }
      return null;
    };

    predictedScores = {
      overall: combineScores(prototypeOverall, individualOverall),
      problem: combineScores(prototypeProblem, individualProblem),
      solution: combineScores(prototypeSolution, individualSolution),
      leadership: combineScores(prototypeLeadership, individualLeadership),
      collaboration: combineScores(prototypeCollaboration, individualCollaboration),
      development: combineScores(prototypeDevelopment, individualDevelopment),
    };
  } else if (useHybridMethod) {
    // 4b. 従来のハイブリッド手法（逆頻度重み使用）

    // スコア分布を取得（各スコアフィールドごと）
    const [
      overallDistribution,
      problemDistribution,
      solutionDistribution,
      leadershipDistribution,
      collaborationDistribution,
      developmentDistribution,
    ] = await Promise.all([
      getScoreDistributionMap(supabase, caseId, question, 'overall'),
      getScoreDistributionMap(supabase, caseId, question, 'problem'),
      getScoreDistributionMap(supabase, caseId, question, 'solution'),
      getScoreDistributionMap(supabase, caseId, question, 'leadership'),
      getScoreDistributionMap(supabase, caseId, question, 'collaboration'),
      getScoreDistributionMap(supabase, caseId, question, 'development'),
    ]);

    // 層別サンプリング（各スコアフィールドごとに個別実施）
    const sampledOverall = stratifiedSampling(
      filteredData.map((r: any) => ({ ...r, score: r.score_overall })),
      'score',
      HYBRID_CONFIG.maxPerBucket
    );
    const sampledProblem = stratifiedSampling(
      filteredData.map((r: any) => ({ ...r, score: r.score_problem })),
      'score',
      HYBRID_CONFIG.maxPerBucket
    );
    const sampledSolution = stratifiedSampling(
      filteredData.map((r: any) => ({ ...r, score: r.score_solution })),
      'score',
      HYBRID_CONFIG.maxPerBucket
    );
    const sampledLeadership = stratifiedSampling(
      filteredData.map((r: any) => ({ ...r, score: r.score_leadership })),
      'score',
      HYBRID_CONFIG.maxPerBucket
    );
    const sampledCollaboration = stratifiedSampling(
      filteredData.map((r: any) => ({ ...r, score: r.score_collaboration })),
      'score',
      HYBRID_CONFIG.maxPerBucket
    );
    const sampledDevelopment = stratifiedSampling(
      filteredData.map((r: any) => ({ ...r, score: r.score_development })),
      'score',
      HYBRID_CONFIG.maxPerBucket
    );

    // ハイブリッド手法で各スコアを計算
    predictedScores = {
      overall: calculateWeightedScoreHybrid(sampledOverall, 'score_overall', overallDistribution),
      problem: calculateWeightedScoreHybrid(sampledProblem, 'score_problem', problemDistribution),
      solution: calculateWeightedScoreHybrid(sampledSolution, 'score_solution', solutionDistribution),
      leadership: calculateWeightedScoreHybrid(sampledLeadership, 'score_leadership', leadershipDistribution),
      collaboration: calculateWeightedScoreHybrid(
        sampledCollaboration,
        'score_collaboration',
        collaborationDistribution
      ),
      development: calculateWeightedScoreHybrid(sampledDevelopment, 'score_development', developmentDistribution),
    };
  } else {
    // 4c. 従来の単純な重み付き平均
    const calculateSimpleWeightedScore = (data: any[], field: string): number | null => {
      const validData = data.filter((r: any) => r[field] != null);
      if (validData.length === 0) return null;

      const weightedSum = validData.reduce((sum: number, r: any) => sum + r[field] * r.similarity, 0);
      const validSimilarity = validData.reduce((sum: number, r: any) => sum + r.similarity, 0);
      return validSimilarity > 0 ? Math.round((weightedSum / validSimilarity) * 10) / 10 : null;
    };

    predictedScores = {
      overall: calculateSimpleWeightedScore(filteredData, 'score_overall'),
      problem: calculateSimpleWeightedScore(filteredData, 'score_problem'),
      solution: calculateSimpleWeightedScore(filteredData, 'score_solution'),
      leadership: calculateSimpleWeightedScore(filteredData, 'score_leadership'),
      collaboration: calculateSimpleWeightedScore(filteredData, 'score_collaboration'),
      development: calculateSimpleWeightedScore(filteredData, 'score_development'),
    };
  }

  // 5. 信頼度を計算（最大類似度と平均類似度を考慮）
  const similarities = filteredData.map((r: any) => r.similarity);
  const maxSimilarity = Math.max(...similarities);
  const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
  
  // 信頼度 = (最大類似度 × 0.6) + (平均類似度 × 0.4)
  // 最大類似度を重視しつつ、全体の類似度も考慮
  const rawConfidence = maxSimilarity * 0.6 + avgSimilarity * 0.4;
  
  // 類似度が高信頼度閾値（70%）未満の場合は信頼度を下げる
  const confidence = maxSimilarity < HYBRID_CONFIG.highConfidenceSimilarity
    ? rawConfidence * 0.8  // 最大でも80%の信頼度
    : rawConfidence;
  
  // 類似度が低い場合のフラグ
  const isLowSimilarity = maxSimilarity < HYBRID_CONFIG.highConfidenceSimilarity;

  // 5.5. 早期品質チェック（API呼び出し前の高速フィルタ）
  const earlyCheck = performEarlyQualityCheck(answerText);
  let isValidAnswer = true;
  let earlyCheckResult: EarlyQualityCheckResult | undefined;
  
  // エンベディングベースのスコアを保存
  const embeddingScores: ScoreItems = { ...predictedScores };

  if (earlyCheck) {
    // 早期チェックで無効と判定された場合
    isValidAnswer = false;
    earlyCheckResult = earlyCheck;
    
    // すべてのスコアを無効回答用のスコアに設定
    predictedScores = {
      overall: AI_SCORING_CONFIG.invalidAnswerScore,
      problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
    };
  }

  // 6. 類似例を抽出（全スコア含む、フィルタ後のデータから）
  const similarExamples: SimilarResponse[] = filteredData.slice(0, 5).map((r: any) => ({
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

  // 7. AI統合評価（スコア＋説明文を生成）
  let explanation: string;
  
  // 低類似度の警告メッセージ
  const lowSimilarityWarning = isLowSimilarity
    ? `【注意】最も類似度の高い回答でも${(maxSimilarity * 100).toFixed(0)}%であり、参考程度としてください。より正確な評価には、このケースの回答データを増やすことをお勧めします。\n\n`
    : '';

  // 早期チェック警告メッセージ
  const earlyCheckWarning = earlyCheckResult
    ? `【警告】この回答は有効な回答として認識されませんでした。理由: ${earlyCheckResult.reason}\n\n`
    : '';
  
  if (useAIExplanation && AI_SCORING_CONFIG.enabled && !earlyCheckResult) {
    // AI統合評価を実行（早期チェックで弾かれていない場合のみ）
    const scoringExamples: ScoringExample[] = filteredData.slice(0, 5).map((r: any) => ({
      responseId: r.response_id,
      score: r.score_overall || r.score_problem || r.score_solution || 0,
      similarity: r.similarity,
      answerText: r.answer_text || '',
      commentProblem: r.comment_problem,
      commentSolution: r.comment_solution,
      commentOverall: r.comment_overall,
    }));

    const aiResult = await generateAIScoring({
      caseContext: caseContext || '',
      question,
      answerText,
      similarExamples: scoringExamples,
      embeddingPredictedScores: embeddingScores,
      confidence: roundedConfidence,
    });

    // AIの評価結果を反映
    isValidAnswer = aiResult.isValidAnswer;
    
    if (aiResult.isValidAnswer && aiResult.scores.overall !== null) {
      // 有効な回答の場合、AIが返したスコアを使用
      predictedScores = {
        overall: aiResult.scores.overall,
        problem: aiResult.scores.problem,
        solution: aiResult.scores.solution,
        leadership: aiResult.scores.leadership,
        collaboration: aiResult.scores.collaboration,
        development: aiResult.scores.development,
      };
    } else if (!aiResult.isValidAnswer) {
      // AIが無効と判断した場合
      predictedScores = {
        overall: AI_SCORING_CONFIG.invalidAnswerScore,
        problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      };
    }
    
    explanation = lowSimilarityWarning + aiResult.explanation;
  } else if (earlyCheckResult) {
    // 早期チェックで弾かれた場合
    explanation = earlyCheckWarning + `ケースの状況を踏まえた具体的な回答を記述してください。`;
  } else {
    // AIを使用しない場合はエンベディングベースのスコアをそのまま使用
    explanation = lowSimilarityWarning + generateExplanation(predictedScores, similarExamples, roundedConfidence);
  }

  return {
    predictedScores,
    embeddingScores,
    confidence: roundedConfidence,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
    isValidAnswer,
    earlyCheckResult,
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
  predictedScores: ScoreItems;  // 複数スコア（AI評価後）
  embeddingScores?: ScoreItems; // エンベディングベースの予測スコア（参考値）
  confidence: number;
  similarCases: SimilarCase[];
  similarExamples: SimilarResponse[];
  explanation: string;
  isValidAnswer?: boolean;      // 有効な回答かどうか
  earlyCheckResult?: EarlyQualityCheckResult;  // 早期チェック結果（無効な場合のみ）
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
  // 注: 型定義と実際の関数シグネチャに不整合がある場合があるためキャスト
  const { data: responsesData, error: responsesError } = await supabase.rpc('find_similar_responses_cross_cases', {
    p_embedding: JSON.stringify(answerEmbedding),
    p_question: question,
    p_limit: topKResponses,
  } as any);

  if (responsesError) {
    console.error('find_similar_responses_cross_cases error:', responsesError);
    throw new Error('類似回答の検索に失敗しました');
  }

  if (!responsesData || responsesData.length === 0) {
    throw new Error('類似回答が見つかりませんでした。類似ケースにはまだ回答データがありません。');
  }

  // 5. 新規ケースではエンベディング予測をスキップ
  // AIが評価基準に基づいて直接スコアを決定する
  let predictedScores: ScoreItems = {
    overall: null,
    problem: null,
    solution: null,
    leadership: null,
    collaboration: null,
    development: null,
  };

  // 6. 信頼度は類似ケースの類似度のみで計算（参考値）
  const maxCaseSimilarity = Math.max(...similarCases.map(c => c.similarity));
  const avgCaseSimilarity = similarCases.reduce((sum, c) => sum + c.similarity, 0) / similarCases.length;
  
  const responseSimilarities = responsesData.map((r: any) => r.similarity);
  const maxResponseSimilarity = Math.max(...responseSimilarities);
  
  // 類似度が低い場合の警告用
  const isLowSimilarity = maxCaseSimilarity < HYBRID_CONFIG.highConfidenceSimilarity;
  
  // 信頼度は類似ケースの類似度のみ（新規ケースのためエンベディング予測は使用しない）
  const confidence = (maxCaseSimilarity * 0.5 + avgCaseSimilarity * 0.5);

  // 6.5. 早期品質チェック（API呼び出し前の高速フィルタ）
  const earlyCheck = performEarlyQualityCheck(answerText);
  let isValidAnswer = true;
  let earlyCheckResult: EarlyQualityCheckResult | undefined;

  if (earlyCheck) {
    // 早期チェックで無効と判定された場合
    isValidAnswer = false;
    earlyCheckResult = earlyCheck;
    
    // すべてのスコアを無効回答用のスコアに設定
    predictedScores = {
      overall: AI_SCORING_CONFIG.invalidAnswerScore,
      problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
    };
  }

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

  // 8. AI統合評価（スコア＋説明文を生成）
  let explanation: string;
  
  // 低類似度の警告メッセージ
  const lowSimilarityWarning = isLowSimilarity
    ? `【注意】最も類似度の高い回答でも${(maxResponseSimilarity * 100).toFixed(0)}%であり、参考程度としてください。\n\n`
    : '';

  // 早期チェック警告メッセージ
  const earlyCheckWarning = earlyCheckResult
    ? `【警告】この回答は有効な回答として認識されませんでした。理由: ${earlyCheckResult.reason}\n\n`
    : '';
  
  if (useAIExplanation && AI_SCORING_CONFIG.enabled && !earlyCheckResult) {
    // AI統合評価を実行（早期チェックで弾かれていない場合のみ）
    // 新規ケースのため、類似回答例は評価スタイルの参考としてのみ使用
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

    // 新規ケース: エンベディング予測値なし、AIが直接評価
    const aiResult = await generateAIScoring({
      caseContext: situationText,
      question,
      answerText,
      similarExamples: scoringExamples,
      similarCases: scoringCases,
      isNewCase: true,  // 新規ケースフラグ
      // embeddingPredictedScores は渡さない（新規ケースのため）
    });

    // AIの評価結果を反映
    isValidAnswer = aiResult.isValidAnswer;
    
    if (aiResult.isValidAnswer && aiResult.scores.overall !== null) {
      // 有効な回答の場合、AIが返したスコアを使用
      predictedScores = {
        overall: aiResult.scores.overall,
        problem: aiResult.scores.problem,
        solution: aiResult.scores.solution,
        leadership: aiResult.scores.leadership,
        collaboration: aiResult.scores.collaboration,
        development: aiResult.scores.development,
      };
    } else if (!aiResult.isValidAnswer) {
      // AIが無効と判断した場合
      predictedScores = {
        overall: AI_SCORING_CONFIG.invalidAnswerScore,
        problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      };
    }
    
    explanation = lowSimilarityWarning + aiResult.explanation;
  } else if (earlyCheckResult) {
    // 早期チェックで弾かれた場合
    explanation = earlyCheckWarning + `ケースの状況を踏まえた具体的な回答を記述してください。`;
  } else {
    // AIを使用しない場合はエンベディングベースのスコアをそのまま使用
    explanation = lowSimilarityWarning + generateNewCaseExplanation(predictedScores, similarCases, similarExamples.slice(0, 3), roundedConfidence);
  }

  return {
    predictedScores,
    // embeddingScores は新規ケースでは undefined（エンベディング予測を行っていない）
    confidence: roundedConfidence,
    similarCases,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
    isValidAnswer,
    earlyCheckResult,
  };
}

// 単純な重み付きスコア計算（類似度を強調）
function calculateWeightedScore(
  data: any[],
  field: string,
  _totalSimilarity: number // 未使用だが互換性のため残す
): number | null {
  const validData = data.filter((r: any) => r[field] != null);
  if (validData.length === 0) return null;

  let weightedSum = 0;
  let totalWeight = 0;

  for (const r of validData) {
    const score = r[field];
    const similarity = r.similarity;

    // 類似度を2乗して重みを計算（高類似度ほど重みが大きくなる）
    const weight = Math.pow(similarity, HYBRID_CONFIG.similarityPower);

    weightedSum += score * weight;
    totalWeight += weight;
  }

  return totalWeight > 0 ? Math.round((weightedSum / totalWeight) * 10) / 10 : null;
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


