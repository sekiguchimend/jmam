// スコア関連ユーティリティ
// スコア帯（例: 3.5点帯）を0.5刻みで扱う

import { embedText } from '@/lib/gemini/embeddings';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { generateAIScoring, performEarlyQualityCheck, type ScoringExample, type ScoringCaseContext, type AIScoringResponse, type EarlyQualityCheckResult, type ScoreDistribution, type ScoreExample } from '@/lib/scoring-prompt';
import {
  calculateProblemScore,
  calculateSolutionScore,
  calculateCollaborationScore,
  estimateLeadershipScore,
  estimateDevelopmentScore,
} from '@/lib/score-calculation';

// スコア項目ごとの刻みと上限の定義
const SCORE_CONFIG = {
  problem: { step: 0.5, max: 5 },           // 問題把握：刻み0.5、上限5
  solution: { step: 0.5, max: 5 },          // 対策立案：刻み0.5、上限5
  role: { step: 0.1, max: 5 },              // 役割理解：刻み0.1、上限5
  leadership: { step: 0.5, max: 4 },        // 主導：刻み0.5、上限4
  collaboration: { step: 0.5, max: 4 },     // 連携：刻み0.5、上限4
  development: { step: 0.5, max: 4 },       // 育成：刻み0.5、上限4
  // 詳細スコア（すべて）：刻み1、上限4
  detail: { step: 1, max: 4 },
} as const;

/**
 * スコアを指定された刻みと上限に合わせて正規化
 */
export function normalizeScore(
  score: number | null | undefined,
  step: number,
  max: number,
  min: number = 1
): number | null {
  if (score === null || score === undefined || !Number.isFinite(score)) return null;
  
  // 上限・下限でクランプ
  const clamped = Math.min(max, Math.max(min, score));
  
  // 刻みに合わせて丸める
  return Math.round(clamped / step) * step;
}

/**
 * 主要スコア項目を正規化
 */
export function normalizeMainScore(
  field: 'problem' | 'solution' | 'role' | 'leadership' | 'collaboration' | 'development',
  score: number | null | undefined
): number | null {
  const config = SCORE_CONFIG[field];
  return normalizeScore(score, config.step, config.max);
}

/**
 * 詳細スコア項目を正規化
 */
export function normalizeDetailScore(score: number | null | undefined): number | null {
  return normalizeScore(score, SCORE_CONFIG.detail.step, SCORE_CONFIG.detail.max);
}

/**
 * スコア帯（バケット）に変換（0.5刻み、主に問題把握・対策立案用）
 * @deprecated 新しいコードでは normalizeMainScore を使用してください
 */
export function toScoreBucket(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(5, Math.max(0, score));
  return Math.round(clamped * 2) / 2;
}

// ハイブリッド手法用の設定
const HYBRID_CONFIG = {
  topK: 50,               // 効率化のため50件に削減（精度への影響は軽微）
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

/**
 * 詳細スコアから主要スコア（problem, solution, collaboration）を計算
 * role, leadership, developmentは詳細スコアがないため、AIまたは推定値を使用
 */
function calculateMainScoresFromDetailScores(detailScores: {
  problemUnderstanding?: number | null;
  problemEssence?: number | null;
  problemMaintenanceBiz?: number | null;
  problemMaintenanceHr?: number | null;
  problemReformBiz?: number | null;
  problemReformHr?: number | null;
  solutionCoverage?: number | null;
  solutionPlanning?: number | null;
  solutionMaintenanceBiz?: number | null;
  solutionMaintenanceHr?: number | null;
  solutionReformBiz?: number | null;
  solutionReformHr?: number | null;
  collabSupervisor?: number | null;
  collabExternal?: number | null;
  collabMember?: number | null;
}, aiScores?: {
  role?: number | null;
  leadership?: number | null;
  development?: number | null;
}): {
  problem: number | null;
  solution: number | null;
  collaboration: number | null;
  role: number | null;
  leadership: number | null;
  development: number | null;
} {
  // 問題把握を詳細スコアから計算
  const problem = calculateProblemScore(
    detailScores.problemUnderstanding,
    detailScores.problemEssence,
    detailScores.problemMaintenanceBiz,
    detailScores.problemMaintenanceHr,
    detailScores.problemReformBiz,
    detailScores.problemReformHr
  );

  // 対策立案を詳細スコアから計算
  const solution = calculateSolutionScore(
    detailScores.solutionCoverage,
    detailScores.solutionPlanning,
    detailScores.solutionMaintenanceBiz,
    detailScores.solutionMaintenanceHr,
    detailScores.solutionReformBiz,
    detailScores.solutionReformHr
  );

  // 連携を詳細スコアから計算
  const collaboration = calculateCollaborationScore(
    detailScores.collabSupervisor,
    detailScores.collabExternal,
    detailScores.collabMember
  );

  // role, leadership, developmentはAI予測値を使用、なければ推定
  let role = aiScores?.role ?? null;
  let leadership = aiScores?.leadership ?? null;
  let development = aiScores?.development ?? null;

  // AI予測がない場合は推定値を使用
  if (leadership == null && solution != null) {
    leadership = estimateLeadershipScore(solution);
  }
  if (development == null && detailScores.solutionMaintenanceHr != null) {
    development = estimateDevelopmentScore(detailScores.solutionMaintenanceHr);
  }
  // roleは(collaboration + leadership) / 2 で推定
  if (role == null && collaboration != null && leadership != null) {
    const rawRole = (collaboration + leadership) / 2;
    role = Math.round(rawRole * 10) / 10; // 0.1刻み
  }

  return {
    problem,
    solution,
    collaboration,
    role,
    leadership,
    development,
  };
}

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

/**
 * 類似回答データからスコア分布を計算（AIの判断基準用）
 */
function calculateScoreDistributions(
  data: any[],
  question: 'q1' | 'q2'
): { detailScores: ScoreDistribution[]; mainScores: ScoreDistribution[] } {
  // 詳細スコアのフィールド定義
  const detailFields = question === 'q1'
    ? [
        { field: 'detail_problem_understanding', label: '状況理解' },
        { field: 'detail_problem_essence', label: '本質把握' },
        { field: 'detail_problem_maintenance_biz', label: '維持管理・業務' },
        { field: 'detail_problem_maintenance_hr', label: '維持管理・人' },
        { field: 'detail_problem_reform_biz', label: '改革・業務' },
        { field: 'detail_problem_reform_hr', label: '改革・人' },
      ]
    : [
        { field: 'detail_solution_coverage', label: '網羅性' },
        { field: 'detail_solution_planning', label: '計画性' },
        { field: 'detail_solution_maintenance_biz', label: '維持管理・業務' },
        { field: 'detail_solution_maintenance_hr', label: '維持管理・人' },
        { field: 'detail_solution_reform_biz', label: '改革・業務' },
        { field: 'detail_solution_reform_hr', label: '改革・人' },
        { field: 'detail_collab_supervisor', label: '上司との連携' },
        { field: 'detail_collab_external', label: '職場外との連携' },
        { field: 'detail_collab_member', label: 'メンバーとの連携' },
      ];

  // 主要スコア（AI直接評価）のフィールド定義
  const mainFields = question === 'q1'
    ? [{ field: 'score_role', label: '役割理解' }]
    : [
        { field: 'score_role', label: '役割理解' },
        { field: 'score_leadership', label: '主導' },
        { field: 'score_development', label: '育成' },
      ];

  // 詳細スコアの分布を計算
  const detailScores: ScoreDistribution[] = detailFields.map(({ field, label }) => {
    const validData = data.filter(r => r[field] != null);
    const distribution: { score: number; count: number }[] = [];

    // 1〜4のスコアごとにカウント
    for (let score = 1; score <= 4; score++) {
      const count = validData.filter(r => r[field] === score).length;
      if (count > 0) {
        distribution.push({ score, count });
      }
    }

    // 最頻値を計算
    let mode: number | null = null;
    let maxCount = 0;
    for (const d of distribution) {
      if (d.count > maxCount) {
        maxCount = d.count;
        mode = d.score;
      }
    }

    // 平均値を計算
    const total = validData.length;
    const sum = validData.reduce((acc, r) => acc + r[field], 0);
    const average = total > 0 ? sum / total : null;

    return { field, label, distribution, mode, average, total };
  });

  // 主要スコアの分布を計算
  const mainScores: ScoreDistribution[] = mainFields.map(({ field, label }) => {
    const validData = data.filter(r => r[field] != null);
    const scoreMap = new Map<number, number>();

    // スコアごとにカウント（0.5刻みまたは0.1刻み）
    for (const r of validData) {
      const score = Math.round(r[field] * 10) / 10; // 0.1刻みに丸め
      scoreMap.set(score, (scoreMap.get(score) || 0) + 1);
    }

    const distribution = Array.from(scoreMap.entries())
      .map(([score, count]) => ({ score, count }))
      .sort((a, b) => a.score - b.score);

    // 最頻値を計算
    let mode: number | null = null;
    let maxCount = 0;
    for (const d of distribution) {
      if (d.count > maxCount) {
        maxCount = d.count;
        mode = d.score;
      }
    }

    // 平均値を計算
    const total = validData.length;
    const sum = validData.reduce((acc, r) => acc + r[field], 0);
    const average = total > 0 ? sum / total : null;

    return { field, label, distribution, mode, average, total };
  });

  return { detailScores, mainScores };
}

/**
 * 類似回答データから各スコア値の回答例を抽出（AIの判断基準用）
 * 各スコア値（1〜4）について、最も類似度の高い回答テキストを取得
 */
function calculateScoreExamples(
  data: any[],
  question: 'q1' | 'q2'
): { detailScores: ScoreExample[]; mainScores: ScoreExample[] } {
  // 詳細スコアのフィールド定義
  const detailFields = question === 'q1'
    ? [
        { field: 'detail_problem_understanding', label: '状況理解', answerField: 'answer_text' },
        { field: 'detail_problem_essence', label: '本質把握', answerField: 'answer_text' },
        { field: 'detail_problem_maintenance_biz', label: '維持管理・業務', answerField: 'answer_text' },
        { field: 'detail_problem_maintenance_hr', label: '維持管理・人', answerField: 'answer_text' },
        { field: 'detail_problem_reform_biz', label: '改革・業務', answerField: 'answer_text' },
        { field: 'detail_problem_reform_hr', label: '改革・人', answerField: 'answer_text' },
      ]
    : [
        { field: 'detail_solution_coverage', label: '網羅性', answerField: 'answer_text' },
        { field: 'detail_solution_planning', label: '計画性', answerField: 'answer_text' },
        { field: 'detail_solution_maintenance_biz', label: '維持管理・業務', answerField: 'answer_text' },
        { field: 'detail_solution_maintenance_hr', label: '維持管理・人', answerField: 'answer_text' },
        { field: 'detail_solution_reform_biz', label: '改革・業務', answerField: 'answer_text' },
        { field: 'detail_solution_reform_hr', label: '改革・人', answerField: 'answer_text' },
        { field: 'detail_collab_supervisor', label: '上司との連携', answerField: 'answer_text' },
        { field: 'detail_collab_external', label: '職場外との連携', answerField: 'answer_text' },
        { field: 'detail_collab_member', label: 'メンバーとの連携', answerField: 'answer_text' },
      ];

  // 主要スコア（AI直接評価）のフィールド定義
  const mainFields = question === 'q1'
    ? [{ field: 'score_role', label: '役割理解', answerField: 'answer_text' }]
    : [
        { field: 'score_role', label: '役割理解', answerField: 'answer_text' },
        { field: 'score_leadership', label: '主導', answerField: 'answer_text' },
        { field: 'score_development', label: '育成', answerField: 'answer_text' },
      ];

  // 詳細スコアの回答例を抽出
  const detailScores: ScoreExample[] = detailFields.map(({ field, label, answerField }) => {
    const examples: { score: number; answerText: string; similarity: number }[] = [];

    // 各スコア値（1〜4）について最も類似度の高い回答を取得
    for (let score = 1; score <= 4; score++) {
      const matchingData = data.filter(r => r[field] === score && r[answerField]);

      if (matchingData.length > 0) {
        // 類似度が最も高い回答を選択
        const bestMatch = matchingData.reduce((best, current) =>
          current.similarity > best.similarity ? current : best
        );

        examples.push({
          score,
          answerText: bestMatch[answerField] || '',
          similarity: bestMatch.similarity,
        });
      }
    }

    return { field, label, examples };
  });

  // 主要スコア（role/leadership/development）の回答例を抽出
  const mainScores: ScoreExample[] = mainFields.map(({ field, label, answerField }) => {
    const examples: { score: number; answerText: string; similarity: number }[] = [];

    // スコア値をグループ化（0.5刻み）
    const scoreGroups = new Map<number, any[]>();
    for (const r of data) {
      if (r[field] != null && r[answerField]) {
        const roundedScore = Math.round(r[field] * 2) / 2; // 0.5刻みに丸める
        if (!scoreGroups.has(roundedScore)) {
          scoreGroups.set(roundedScore, []);
        }
        scoreGroups.get(roundedScore)!.push(r);
      }
    }

    // 各スコア値グループから最も類似度の高い回答を取得（代表的な値のみ）
    // 全スコアを出すと多すぎるので、低・中・高の代表値のみ抽出
    const representativeScores = [1.0, 1.5, 2.0, 2.5, 3.0, 3.5, 4.0];
    for (const targetScore of representativeScores) {
      const group = scoreGroups.get(targetScore);
      if (group && group.length > 0) {
        const bestMatch = group.reduce((best, current) =>
          current.similarity > best.similarity ? current : best
        );
        examples.push({
          score: targetScore,
          answerText: bestMatch[answerField] || '',
          similarity: bestMatch.similarity,
        });
      }
    }

    return { field, label, examples };
  });

  return { detailScores, mainScores };
}

// 個別スコア項目の型定義（回答スコアのScores型と一致）
export type ScoreItems = {
  // 主要スコア（6項目）
  problem: number | null;      // 問題把握
  solution: number | null;     // 対策立案
  role: number | null;         // 役割理解
  leadership: number | null;   // 主導
  collaboration: number | null; // 連携
  development: number | null;  // 育成
  // 問題把握の詳細スコア（6項目）
  problemUnderstanding?: number | null;     // 状況理解
  problemEssence?: number | null;           // 本質把握
  problemMaintenanceBiz?: number | null;    // 維持管理・業務
  problemMaintenanceHr?: number | null;     // 維持管理・人
  problemReformBiz?: number | null;         // 改革・業務
  problemReformHr?: number | null;          // 改革・人
  // 対策立案の詳細スコア（6項目）
  solutionCoverage?: number | null;         // 網羅性
  solutionPlanning?: number | null;         // 計画性
  solutionMaintenanceBiz?: number | null;   // 維持管理・業務
  solutionMaintenanceHr?: number | null;    // 維持管理・人
  solutionReformBiz?: number | null;        // 改革・業務
  solutionReformHr?: number | null;         // 改革・人
  // 連携の詳細スコア（3項目）
  collabSupervisor?: number | null;         // 上司
  collabExternal?: number | null;           // 職場外
  collabMember?: number | null;             // メンバー
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
    // 4a. 詳細スコアをルックアップ + ハイブリッド手法で予測し、主要スコアは計算式で算出

    // 詳細スコア用の予測関数
    // ルックアップ（類似度加重最頻値）をメインに、プロトタイプと個別回答を補助的に使用
    const predictDetailScoreHybrid = (field: string): number | null => {
      const validData: any[] = filteredData.filter((r: any) => r[field] != null);
      if (validData.length === 0) return null;

      // 1. スコア帯ごとにグループ化（詳細スコアは1-4の整数）
      const grouped = new Map<number, { totalSimilarity: number; count: number; maxSimilarity: number }>();
      for (const r of validData) {
        const score = r[field];
        if (!grouped.has(score)) {
          grouped.set(score, { totalSimilarity: 0, count: 0, maxSimilarity: 0 });
        }
        const g = grouped.get(score)!;
        g.totalSimilarity += r.similarity;
        g.count++;
        g.maxSimilarity = Math.max(g.maxSimilarity, r.similarity);
      }

      // 2. ルックアップ: 類似度加重最頻値を計算
      // スコア = (頻度 × 合計類似度) が最大のものを採用
      let lookupScore: number | null = null;
      let maxLookupWeight = 0;
      for (const [score, g] of grouped) {
        // 頻度と類似度の両方を考慮した重み
        const lookupWeight = g.count * g.totalSimilarity;
        if (lookupWeight > maxLookupWeight) {
          maxLookupWeight = lookupWeight;
          lookupScore = score;
        }
      }

      // 3. 最高類似度の回答のスコアを取得
      let topSimilarityScore: number | null = null;
      let topSimilarity = 0;
      for (const r of validData) {
        if (r.similarity > topSimilarity) {
          topSimilarity = r.similarity;
          topSimilarityScore = r[field];
        }
      }

      // 4. プロトタイプベースの予測（Softmax）
      const prototypes: { score: number; similarity: number }[] = [];
      for (const [score, g] of grouped) {
        prototypes.push({ score, similarity: g.totalSimilarity / g.count });
      }
      const validPrototypes = prototypes.filter(
        p => p.similarity >= PROTOTYPE_CONFIG.minPrototypeSimilarity
      );

      let prototypeScore: number | null = null;
      if (validPrototypes.length > 0) {
        const similarities = validPrototypes.map(p => p.similarity);
        const weights = softmax(similarities, PROTOTYPE_CONFIG.temperatureScaling);
        prototypeScore = 0;
        validPrototypes.forEach((p, i) => {
          prototypeScore! += p.score * weights[i];
        });
      }

      // 5. 最終スコアの決定
      // 優先順位: 最高類似度が十分高い場合はそのスコア、そうでなければルックアップ、最後にプロトタイプ
      let finalScore: number | null = null;

      if (topSimilarity >= 0.8 && topSimilarityScore !== null) {
        // 類似度80%以上の回答があれば、そのスコアを採用
        finalScore = topSimilarityScore;
      } else if (lookupScore !== null && topSimilarity >= 0.6) {
        // 類似度60%以上でルックアップ結果があれば、ルックアップを採用
        finalScore = lookupScore;
      } else if (prototypeScore !== null) {
        // プロトタイプベースの予測を使用
        finalScore = prototypeScore;
      } else if (lookupScore !== null) {
        // フォールバック: ルックアップ
        finalScore = lookupScore;
      }

      // 詳細スコアは刻み1、上限4で正規化
      return normalizeDetailScore(finalScore);
    };

    // 詳細スコアを予測
    const detailScores = {
      // 問題把握の詳細スコア
      problemUnderstanding: predictDetailScoreHybrid('detail_problem_understanding'),
      problemEssence: predictDetailScoreHybrid('detail_problem_essence'),
      problemMaintenanceBiz: predictDetailScoreHybrid('detail_problem_maintenance_biz'),
      problemMaintenanceHr: predictDetailScoreHybrid('detail_problem_maintenance_hr'),
      problemReformBiz: predictDetailScoreHybrid('detail_problem_reform_biz'),
      problemReformHr: predictDetailScoreHybrid('detail_problem_reform_hr'),
      // 対策立案の詳細スコア
      solutionCoverage: predictDetailScoreHybrid('detail_solution_coverage'),
      solutionPlanning: predictDetailScoreHybrid('detail_solution_planning'),
      solutionMaintenanceBiz: predictDetailScoreHybrid('detail_solution_maintenance_biz'),
      solutionMaintenanceHr: predictDetailScoreHybrid('detail_solution_maintenance_hr'),
      solutionReformBiz: predictDetailScoreHybrid('detail_solution_reform_biz'),
      solutionReformHr: predictDetailScoreHybrid('detail_solution_reform_hr'),
      // 連携の詳細スコア
      collabSupervisor: predictDetailScoreHybrid('detail_collab_supervisor'),
      collabExternal: predictDetailScoreHybrid('detail_collab_external'),
      collabMember: predictDetailScoreHybrid('detail_collab_member'),
    };

    // 主要スコアは詳細スコアから計算式で算出
    // role, leadership, developmentは後でAI予測または推定値を使用するため、ここではnull
    const calculatedMainScores = calculateMainScoresFromDetailScores(detailScores);

    predictedScores = {
      // 主要スコア（詳細スコアから計算式で算出）
      problem: calculatedMainScores.problem,
      solution: calculatedMainScores.solution,
      collaboration: calculatedMainScores.collaboration,
      // role, leadership, developmentはAI評価後に設定（ここではnull）
      role: null,
      leadership: null,
      development: null,
      // 詳細スコア
      ...detailScores,
    };
  } else {
    // 4b. フォールバック: ルックアップベースの予測
    // 詳細スコアを予測し、主要スコアは計算式で算出

    const predictDetailScoreLookup = (field: string): number | null => {
      const validData: any[] = filteredData.filter((r: any) => r[field] != null);
      if (validData.length === 0) return null;

      // スコア帯ごとにグループ化
      const grouped = new Map<number, { totalSimilarity: number; count: number; maxSimilarity: number }>();
      for (const r of validData) {
        const score = r[field];
        if (!grouped.has(score)) {
          grouped.set(score, { totalSimilarity: 0, count: 0, maxSimilarity: 0 });
        }
        const g = grouped.get(score)!;
        g.totalSimilarity += r.similarity;
        g.count++;
        g.maxSimilarity = Math.max(g.maxSimilarity, r.similarity);
      }

      // ルックアップ: 類似度加重最頻値を採用
      let lookupScore: number | null = null;
      let maxLookupWeight = 0;
      for (const [score, g] of grouped) {
        const lookupWeight = g.count * g.totalSimilarity;
        if (lookupWeight > maxLookupWeight) {
          maxLookupWeight = lookupWeight;
          lookupScore = score;
        }
      }

      // 最高類似度の回答のスコア
      let topSimilarityScore: number | null = null;
      let topSimilarity = 0;
      for (const r of validData) {
        if (r.similarity > topSimilarity) {
          topSimilarity = r.similarity;
          topSimilarityScore = r[field];
        }
      }

      // 優先順位: 高類似度 > ルックアップ
      let finalScore: number | null = null;
      if (topSimilarity >= 0.8 && topSimilarityScore !== null) {
        finalScore = topSimilarityScore;
      } else if (lookupScore !== null) {
        finalScore = lookupScore;
      }

      return normalizeDetailScore(finalScore);
    };

    // 詳細スコアを予測
    const detailScores = {
      problemUnderstanding: predictDetailScoreLookup('detail_problem_understanding'),
      problemEssence: predictDetailScoreLookup('detail_problem_essence'),
      problemMaintenanceBiz: predictDetailScoreLookup('detail_problem_maintenance_biz'),
      problemMaintenanceHr: predictDetailScoreLookup('detail_problem_maintenance_hr'),
      problemReformBiz: predictDetailScoreLookup('detail_problem_reform_biz'),
      problemReformHr: predictDetailScoreLookup('detail_problem_reform_hr'),
      solutionCoverage: predictDetailScoreLookup('detail_solution_coverage'),
      solutionPlanning: predictDetailScoreLookup('detail_solution_planning'),
      solutionMaintenanceBiz: predictDetailScoreLookup('detail_solution_maintenance_biz'),
      solutionMaintenanceHr: predictDetailScoreLookup('detail_solution_maintenance_hr'),
      solutionReformBiz: predictDetailScoreLookup('detail_solution_reform_biz'),
      solutionReformHr: predictDetailScoreLookup('detail_solution_reform_hr'),
      collabSupervisor: predictDetailScoreLookup('detail_collab_supervisor'),
      collabExternal: predictDetailScoreLookup('detail_collab_external'),
      collabMember: predictDetailScoreLookup('detail_collab_member'),
    };

    // 主要スコアは詳細スコアから計算式で算出
    const calculatedMainScores = calculateMainScoresFromDetailScores(detailScores);

    predictedScores = {
      problem: calculatedMainScores.problem,
      solution: calculatedMainScores.solution,
      collaboration: calculatedMainScores.collaboration,
      role: null,
      leadership: null,
      development: null,
      ...detailScores,
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

    // すべてのスコアを無効回答用のスコアに設定（詳細スコアも最低値1）
    predictedScores = {
      problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      role: AI_SCORING_CONFIG.invalidAnswerScore,
      leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      // 詳細スコア（無効な回答は最低値1）
      problemUnderstanding: question === 'q1' ? 1 : null,
      problemEssence: question === 'q1' ? 1 : null,
      problemMaintenanceBiz: question === 'q1' ? 1 : null,
      problemMaintenanceHr: question === 'q1' ? 1 : null,
      problemReformBiz: question === 'q1' ? 1 : null,
      problemReformHr: question === 'q1' ? 1 : null,
      solutionCoverage: question === 'q2' ? 1 : null,
      solutionPlanning: question === 'q2' ? 1 : null,
      solutionMaintenanceBiz: question === 'q2' ? 1 : null,
      solutionMaintenanceHr: question === 'q2' ? 1 : null,
      solutionReformBiz: question === 'q2' ? 1 : null,
      solutionReformHr: question === 'q2' ? 1 : null,
      collabSupervisor: question === 'q2' ? 1 : null,
      collabExternal: question === 'q2' ? 1 : null,
      collabMember: question === 'q2' ? 1 : null,
    };
  }

  // 6. 類似例を抽出（全スコア含む、フィルタ後のデータから）
  const similarExamples: SimilarResponse[] = filteredData.slice(0, 5).map((r: any) => ({
    responseId: r.response_id,
    scores: {
      problem: r.score_problem != null ? Math.round(r.score_problem * 10) / 10 : null,
      solution: r.score_solution != null ? Math.round(r.score_solution * 10) / 10 : null,
      role: r.score_role != null ? Math.round(r.score_role * 10) / 10 : null,
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
      // 主要スコア（AIの参考用）
      scores: {
        problem: r.score_problem,
        solution: r.score_solution,
        role: r.score_role,
        leadership: r.score_leadership,
        collaboration: r.score_collaboration,
        development: r.score_development,
      },
      // 詳細スコア（AIの参考用）
      detailScores: {
        problemUnderstanding: r.detail_problem_understanding,
        problemEssence: r.detail_problem_essence,
        problemMaintenanceBiz: r.detail_problem_maintenance_biz,
        problemMaintenanceHr: r.detail_problem_maintenance_hr,
        problemReformBiz: r.detail_problem_reform_biz,
        problemReformHr: r.detail_problem_reform_hr,
        solutionCoverage: r.detail_solution_coverage,
        solutionPlanning: r.detail_solution_planning,
        solutionMaintenanceBiz: r.detail_solution_maintenance_biz,
        solutionMaintenanceHr: r.detail_solution_maintenance_hr,
        solutionReformBiz: r.detail_solution_reform_biz,
        solutionReformHr: r.detail_solution_reform_hr,
        collabSupervisor: r.detail_collab_supervisor,
        collabExternal: r.detail_collab_external,
        collabMember: r.detail_collab_member,
      },
      commentProblem: r.comment_problem,
      commentSolution: r.comment_solution,
      commentOverall: r.comment_overall,
    }));

    // スコア分布を計算（AIの判断基準用）
    const scoreDistributions = calculateScoreDistributions(filteredData, question);

    // 各スコア値の回答例を抽出（AIの判断基準用）
    const scoreExamples = calculateScoreExamples(filteredData, question);

    const aiResult = await generateAIScoring({
      caseContext: caseContext || '',
      question,
      answerText,
      similarExamples: scoringExamples,
      scoreDistributions,  // スコア分布（判断基準）
      scoreExamples,       // 各スコア値の回答例（判断基準）
      embeddingPredictedScores: {
        problem: embeddingScores.problem,
        solution: embeddingScores.solution,
        role: embeddingScores.role,
        leadership: embeddingScores.leadership,
        collaboration: embeddingScores.collaboration,
        development: embeddingScores.development,
      },
      confidence: roundedConfidence,
    });

    // AIの評価結果を反映
    isValidAnswer = aiResult.isValidAnswer;

    if (aiResult.isValidAnswer) {
      // 有効な回答の場合、AIが直接評価した詳細スコアを使用
      // 主要スコアは詳細スコアから計算式で算出（AIの主要スコアは使用しない）
      const aiDetailScores = aiResult.detailScores;

      // AIの詳細スコアを正規化（エンベディングベースをフォールバックとして使用）
      const normalizedDetailScores = {
        problemUnderstanding: normalizeDetailScore(aiDetailScores?.problemUnderstanding ?? embeddingScores.problemUnderstanding),
        problemEssence: normalizeDetailScore(aiDetailScores?.problemEssence ?? embeddingScores.problemEssence),
        problemMaintenanceBiz: normalizeDetailScore(aiDetailScores?.problemMaintenanceBiz ?? embeddingScores.problemMaintenanceBiz),
        problemMaintenanceHr: normalizeDetailScore(aiDetailScores?.problemMaintenanceHr ?? embeddingScores.problemMaintenanceHr),
        problemReformBiz: normalizeDetailScore(aiDetailScores?.problemReformBiz ?? embeddingScores.problemReformBiz),
        problemReformHr: normalizeDetailScore(aiDetailScores?.problemReformHr ?? embeddingScores.problemReformHr),
        solutionCoverage: normalizeDetailScore(aiDetailScores?.solutionCoverage ?? embeddingScores.solutionCoverage),
        solutionPlanning: normalizeDetailScore(aiDetailScores?.solutionPlanning ?? embeddingScores.solutionPlanning),
        solutionMaintenanceBiz: normalizeDetailScore(aiDetailScores?.solutionMaintenanceBiz ?? embeddingScores.solutionMaintenanceBiz),
        solutionMaintenanceHr: normalizeDetailScore(aiDetailScores?.solutionMaintenanceHr ?? embeddingScores.solutionMaintenanceHr),
        solutionReformBiz: normalizeDetailScore(aiDetailScores?.solutionReformBiz ?? embeddingScores.solutionReformBiz),
        solutionReformHr: normalizeDetailScore(aiDetailScores?.solutionReformHr ?? embeddingScores.solutionReformHr),
        collabSupervisor: normalizeDetailScore(aiDetailScores?.collabSupervisor ?? embeddingScores.collabSupervisor),
        collabExternal: normalizeDetailScore(aiDetailScores?.collabExternal ?? embeddingScores.collabExternal),
        collabMember: normalizeDetailScore(aiDetailScores?.collabMember ?? embeddingScores.collabMember),
      };

      // 詳細スコアから主要スコア（problem/solution/collaboration）を計算
      // role/leadership/developmentはAIが直接評価した値を使用
      const calculatedMainScores = calculateMainScoresFromDetailScores(normalizedDetailScores, {
        role: aiResult.scores.role,
        leadership: aiResult.scores.leadership,
        development: aiResult.scores.development,
      });

      predictedScores = {
        // 主要スコア
        // problem/solution/collaboration: 詳細スコアから計算式で算出
        // role/leadership/development: AIが直接評価
        problem: question === 'q1' ? calculatedMainScores.problem : null,
        solution: question === 'q2' ? calculatedMainScores.solution : null,
        role: normalizeMainScore('role', calculatedMainScores.role),
        leadership: question === 'q2' ? normalizeMainScore('leadership', calculatedMainScores.leadership) : null,
        collaboration: question === 'q2' ? normalizeMainScore('collaboration', calculatedMainScores.collaboration) : null,
        development: question === 'q2' ? normalizeMainScore('development', calculatedMainScores.development) : null,
        // 詳細スコア（AIが直接評価）
        ...normalizedDetailScores,
      };
    } else if (!aiResult.isValidAnswer) {
      // AIが無効と判断した場合（詳細スコアは最低値1を設定）
      predictedScores = {
        problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        role: AI_SCORING_CONFIG.invalidAnswerScore,
        leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        // 詳細スコア（無効な回答は最低値1）
        problemUnderstanding: question === 'q1' ? 1 : null,
        problemEssence: question === 'q1' ? 1 : null,
        problemMaintenanceBiz: question === 'q1' ? 1 : null,
        problemMaintenanceHr: question === 'q1' ? 1 : null,
        problemReformBiz: question === 'q1' ? 1 : null,
        problemReformHr: question === 'q1' ? 1 : null,
        solutionCoverage: question === 'q2' ? 1 : null,
        solutionPlanning: question === 'q2' ? 1 : null,
        solutionMaintenanceBiz: question === 'q2' ? 1 : null,
        solutionMaintenanceHr: question === 'q2' ? 1 : null,
        solutionReformBiz: question === 'q2' ? 1 : null,
        solutionReformHr: question === 'q2' ? 1 : null,
        collabSupervisor: question === 'q2' ? 1 : null,
        collabExternal: question === 'q2' ? 1 : null,
        collabMember: question === 'q2' ? 1 : null,
      };
    }

    explanation = lowSimilarityWarning + aiResult.explanation;
  } else if (earlyCheckResult) {
    // 早期チェックで弾かれた場合（詳細スコアは最低値1を設定）
    predictedScores = {
      problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      role: AI_SCORING_CONFIG.invalidAnswerScore,
      leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      problemUnderstanding: question === 'q1' ? 1 : null,
      problemEssence: question === 'q1' ? 1 : null,
      problemMaintenanceBiz: question === 'q1' ? 1 : null,
      problemMaintenanceHr: question === 'q1' ? 1 : null,
      problemReformBiz: question === 'q1' ? 1 : null,
      problemReformHr: question === 'q1' ? 1 : null,
      solutionCoverage: question === 'q2' ? 1 : null,
      solutionPlanning: question === 'q2' ? 1 : null,
      solutionMaintenanceBiz: question === 'q2' ? 1 : null,
      solutionMaintenanceHr: question === 'q2' ? 1 : null,
      solutionReformBiz: question === 'q2' ? 1 : null,
      solutionReformHr: question === 'q2' ? 1 : null,
      collabSupervisor: question === 'q2' ? 1 : null,
      collabExternal: question === 'q2' ? 1 : null,
      collabMember: question === 'q2' ? 1 : null,
    };
    explanation = earlyCheckWarning + `ケースの状況を踏まえた具体的な回答を記述してください。`;
  } else {
    // AIを使用しない場合も詳細スコアから主要スコアを計算
    const normalizedDetailScores = {
      problemUnderstanding: normalizeDetailScore(embeddingScores.problemUnderstanding),
      problemEssence: normalizeDetailScore(embeddingScores.problemEssence),
      problemMaintenanceBiz: normalizeDetailScore(embeddingScores.problemMaintenanceBiz),
      problemMaintenanceHr: normalizeDetailScore(embeddingScores.problemMaintenanceHr),
      problemReformBiz: normalizeDetailScore(embeddingScores.problemReformBiz),
      problemReformHr: normalizeDetailScore(embeddingScores.problemReformHr),
      solutionCoverage: normalizeDetailScore(embeddingScores.solutionCoverage),
      solutionPlanning: normalizeDetailScore(embeddingScores.solutionPlanning),
      solutionMaintenanceBiz: normalizeDetailScore(embeddingScores.solutionMaintenanceBiz),
      solutionMaintenanceHr: normalizeDetailScore(embeddingScores.solutionMaintenanceHr),
      solutionReformBiz: normalizeDetailScore(embeddingScores.solutionReformBiz),
      solutionReformHr: normalizeDetailScore(embeddingScores.solutionReformHr),
      collabSupervisor: normalizeDetailScore(embeddingScores.collabSupervisor),
      collabExternal: normalizeDetailScore(embeddingScores.collabExternal),
      collabMember: normalizeDetailScore(embeddingScores.collabMember),
    };

    const calculatedMainScores = calculateMainScoresFromDetailScores(normalizedDetailScores);

    predictedScores = {
      problem: question === 'q1' ? calculatedMainScores.problem : null,
      solution: question === 'q2' ? calculatedMainScores.solution : null,
      role: normalizeMainScore('role', calculatedMainScores.role),
      leadership: question === 'q2' ? normalizeMainScore('leadership', calculatedMainScores.leadership) : null,
      collaboration: question === 'q2' ? normalizeMainScore('collaboration', calculatedMainScores.collaboration) : null,
      development: question === 'q2' ? normalizeMainScore('development', calculatedMainScores.development) : null,
      ...normalizedDetailScores,
    };

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
  const representativeScore = scores.problem || scores.solution || 0;
  const scoreLevel = representativeScore >= 3.5 ? '高評価' : representativeScore >= 2.5 ? '中程度' : '低評価';

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

  // 5. 詳細スコアを予測し、主要スコアは計算式で算出
  const totalSimilarity = responsesData.reduce((sum: number, r: any) => sum + r.similarity, 0);

  // 詳細スコアを予測（ルックアップ + ハイブリッド手法）
  const predictDetailScoreForNewCase = (field: string): number | null => {
    const validData: any[] = responsesData.filter((r: any) => r[field] != null);
    if (validData.length === 0) return null;

    // スコア帯ごとにグループ化
    const grouped = new Map<number, { totalSimilarity: number; count: number; maxSimilarity: number }>();
    for (const r of validData) {
      const score = r[field];
      if (!grouped.has(score)) {
        grouped.set(score, { totalSimilarity: 0, count: 0, maxSimilarity: 0 });
      }
      const g = grouped.get(score)!;
      g.totalSimilarity += r.similarity;
      g.count++;
      g.maxSimilarity = Math.max(g.maxSimilarity, r.similarity);
    }

    // ルックアップ: 類似度加重最頻値を計算
    let lookupScore: number | null = null;
    let maxLookupWeight = 0;
    for (const [score, g] of grouped) {
      const lookupWeight = g.count * g.totalSimilarity;
      if (lookupWeight > maxLookupWeight) {
        maxLookupWeight = lookupWeight;
        lookupScore = score;
      }
    }

    // 最高類似度の回答のスコアを取得
    let topSimilarityScore: number | null = null;
    let topSimilarity = 0;
    for (const r of validData) {
      if (r.similarity > topSimilarity) {
        topSimilarity = r.similarity;
        topSimilarityScore = r[field];
      }
    }

    // プロトタイプベースの予測（Softmax）
    const prototypes: { score: number; similarity: number }[] = [];
    for (const [score, g] of grouped) {
      prototypes.push({ score, similarity: g.totalSimilarity / g.count });
    }
    const validPrototypes = prototypes.filter(
      p => p.similarity >= PROTOTYPE_CONFIG.minPrototypeSimilarity
    );

    let prototypeScore: number | null = null;
    if (validPrototypes.length > 0) {
      const similarities = validPrototypes.map(p => p.similarity);
      const weights = softmax(similarities, PROTOTYPE_CONFIG.temperatureScaling);
      prototypeScore = 0;
      validPrototypes.forEach((p, i) => {
        prototypeScore! += p.score * weights[i];
      });
    }

    // 最終スコアの決定
    let finalScore: number | null = null;
    if (topSimilarity >= 0.8 && topSimilarityScore !== null) {
      finalScore = topSimilarityScore;
    } else if (lookupScore !== null && topSimilarity >= 0.6) {
      finalScore = lookupScore;
    } else if (prototypeScore !== null) {
      finalScore = prototypeScore;
    } else if (lookupScore !== null) {
      finalScore = lookupScore;
    }

    return normalizeDetailScore(finalScore);
  };

  // 詳細スコアを予測
  const detailScores = {
    problemUnderstanding: predictDetailScoreForNewCase('detail_problem_understanding'),
    problemEssence: predictDetailScoreForNewCase('detail_problem_essence'),
    problemMaintenanceBiz: predictDetailScoreForNewCase('detail_problem_maintenance_biz'),
    problemMaintenanceHr: predictDetailScoreForNewCase('detail_problem_maintenance_hr'),
    problemReformBiz: predictDetailScoreForNewCase('detail_problem_reform_biz'),
    problemReformHr: predictDetailScoreForNewCase('detail_problem_reform_hr'),
    solutionCoverage: predictDetailScoreForNewCase('detail_solution_coverage'),
    solutionPlanning: predictDetailScoreForNewCase('detail_solution_planning'),
    solutionMaintenanceBiz: predictDetailScoreForNewCase('detail_solution_maintenance_biz'),
    solutionMaintenanceHr: predictDetailScoreForNewCase('detail_solution_maintenance_hr'),
    solutionReformBiz: predictDetailScoreForNewCase('detail_solution_reform_biz'),
    solutionReformHr: predictDetailScoreForNewCase('detail_solution_reform_hr'),
    collabSupervisor: predictDetailScoreForNewCase('detail_collab_supervisor'),
    collabExternal: predictDetailScoreForNewCase('detail_collab_external'),
    collabMember: predictDetailScoreForNewCase('detail_collab_member'),
  };

  // 主要スコアは詳細スコアから計算式で算出
  const calculatedMainScores = calculateMainScoresFromDetailScores(detailScores);

  // エンベディングベースの予測スコア（詳細スコア + 計算済み主要スコア）
  const embeddingScores: ScoreItems = {
    problem: calculatedMainScores.problem,
    solution: calculatedMainScores.solution,
    collaboration: calculatedMainScores.collaboration,
    role: null,
    leadership: null,
    development: null,
    ...detailScores,
  };

  // 最終スコア（AIが決定、初期値はnull）
  let predictedScores: ScoreItems = {
    problem: null,
    solution: null,
    role: null,
    leadership: null,
    collaboration: null,
    development: null,
  };

  // 6. 信頼度を計算（参考値）
  const maxCaseSimilarity = Math.max(...similarCases.map(c => c.similarity));
  const avgCaseSimilarity = similarCases.reduce((sum, c) => sum + c.similarity, 0) / similarCases.length;
  
  const responseSimilarities = responsesData.map((r: any) => r.similarity);
  const maxResponseSimilarity = Math.max(...responseSimilarities);
  const avgResponseSimilarity = totalSimilarity / responsesData.length;
  
  // 類似度が低い場合の警告用
  const isLowSimilarity = maxCaseSimilarity < HYBRID_CONFIG.highConfidenceSimilarity;
  
  // 信頼度（新規ケースのため参考値）
  const rawConfidence = (maxCaseSimilarity * 0.3 + avgCaseSimilarity * 0.2 + maxResponseSimilarity * 0.3 + avgResponseSimilarity * 0.2);
  const confidence = isLowSimilarity ? rawConfidence * 0.8 : rawConfidence;

  // 6.5. 早期品質チェック（API呼び出し前の高速フィルタ）
  const earlyCheck = performEarlyQualityCheck(answerText);
  let isValidAnswer = true;
  let earlyCheckResult: EarlyQualityCheckResult | undefined;

  if (earlyCheck) {
    // 早期チェックで無効と判定された場合
    isValidAnswer = false;
    earlyCheckResult = earlyCheck;

    // すべてのスコアを無効回答用のスコアに設定（詳細スコアも最低値1）
    predictedScores = {
      problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      role: AI_SCORING_CONFIG.invalidAnswerScore,
      leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      // 詳細スコア（無効な回答は最低値1）
      problemUnderstanding: question === 'q1' ? 1 : null,
      problemEssence: question === 'q1' ? 1 : null,
      problemMaintenanceBiz: question === 'q1' ? 1 : null,
      problemMaintenanceHr: question === 'q1' ? 1 : null,
      problemReformBiz: question === 'q1' ? 1 : null,
      problemReformHr: question === 'q1' ? 1 : null,
      solutionCoverage: question === 'q2' ? 1 : null,
      solutionPlanning: question === 'q2' ? 1 : null,
      solutionMaintenanceBiz: question === 'q2' ? 1 : null,
      solutionMaintenanceHr: question === 'q2' ? 1 : null,
      solutionReformBiz: question === 'q2' ? 1 : null,
      solutionReformHr: question === 'q2' ? 1 : null,
      collabSupervisor: question === 'q2' ? 1 : null,
      collabExternal: question === 'q2' ? 1 : null,
      collabMember: question === 'q2' ? 1 : null,
    };
  }

  // 7. 類似例を抽出（全スコア含む）
  const similarExamples: SimilarResponse[] = responsesData.slice(0, 5).map((r: any) => ({
    responseId: r.response_id,
    scores: {
      problem: r.score_problem != null ? Math.round(r.score_problem * 10) / 10 : null,
      solution: r.score_solution != null ? Math.round(r.score_solution * 10) / 10 : null,
      role: r.score_role != null ? Math.round(r.score_role * 10) / 10 : null,
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
      // 主要スコア（AIの参考用）
      scores: {
        problem: r.score_problem,
        solution: r.score_solution,
        role: r.score_role,
        leadership: r.score_leadership,
        collaboration: r.score_collaboration,
        development: r.score_development,
      },
      // 詳細スコア（AIの参考用）
      detailScores: {
        problemUnderstanding: r.detail_problem_understanding,
        problemEssence: r.detail_problem_essence,
        problemMaintenanceBiz: r.detail_problem_maintenance_biz,
        problemMaintenanceHr: r.detail_problem_maintenance_hr,
        problemReformBiz: r.detail_problem_reform_biz,
        problemReformHr: r.detail_problem_reform_hr,
        solutionCoverage: r.detail_solution_coverage,
        solutionPlanning: r.detail_solution_planning,
        solutionMaintenanceBiz: r.detail_solution_maintenance_biz,
        solutionMaintenanceHr: r.detail_solution_maintenance_hr,
        solutionReformBiz: r.detail_solution_reform_biz,
        solutionReformHr: r.detail_solution_reform_hr,
        collabSupervisor: r.detail_collab_supervisor,
        collabExternal: r.detail_collab_external,
        collabMember: r.detail_collab_member,
      },
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

    // スコア分布を計算（AIの判断基準用）
    const scoreDistributions = calculateScoreDistributions(responsesData, question);

    // 各スコア値の回答例を抽出（AIの判断基準用）
    const scoreExamples = calculateScoreExamples(responsesData, question);

    // 新規ケース: エンベディング予測値なし、AIが直接評価
    const aiResult = await generateAIScoring({
      caseContext: situationText,
      question,
      answerText,
      similarExamples: scoringExamples,
      similarCases: scoringCases,
      scoreDistributions,  // スコア分布（判断基準）
      scoreExamples,       // 各スコア値の回答例（判断基準）
      isNewCase: true,  // 新規ケースフラグ
      // embeddingPredictedScores は渡さない（新規ケースのため）
    });

    // AIの評価結果を反映
    isValidAnswer = aiResult.isValidAnswer;

    if (aiResult.isValidAnswer) {
      // 有効な回答の場合、AIが直接評価した詳細スコアを使用
      // 主要スコアは詳細スコアから計算式で算出（AIの主要スコアは使用しない）
      const aiDetailScores = aiResult.detailScores;

      // AIの詳細スコアを正規化（エンベディングベースをフォールバックとして使用）
      const normalizedDetailScores = {
        problemUnderstanding: normalizeDetailScore(aiDetailScores?.problemUnderstanding ?? embeddingScores.problemUnderstanding),
        problemEssence: normalizeDetailScore(aiDetailScores?.problemEssence ?? embeddingScores.problemEssence),
        problemMaintenanceBiz: normalizeDetailScore(aiDetailScores?.problemMaintenanceBiz ?? embeddingScores.problemMaintenanceBiz),
        problemMaintenanceHr: normalizeDetailScore(aiDetailScores?.problemMaintenanceHr ?? embeddingScores.problemMaintenanceHr),
        problemReformBiz: normalizeDetailScore(aiDetailScores?.problemReformBiz ?? embeddingScores.problemReformBiz),
        problemReformHr: normalizeDetailScore(aiDetailScores?.problemReformHr ?? embeddingScores.problemReformHr),
        solutionCoverage: normalizeDetailScore(aiDetailScores?.solutionCoverage ?? embeddingScores.solutionCoverage),
        solutionPlanning: normalizeDetailScore(aiDetailScores?.solutionPlanning ?? embeddingScores.solutionPlanning),
        solutionMaintenanceBiz: normalizeDetailScore(aiDetailScores?.solutionMaintenanceBiz ?? embeddingScores.solutionMaintenanceBiz),
        solutionMaintenanceHr: normalizeDetailScore(aiDetailScores?.solutionMaintenanceHr ?? embeddingScores.solutionMaintenanceHr),
        solutionReformBiz: normalizeDetailScore(aiDetailScores?.solutionReformBiz ?? embeddingScores.solutionReformBiz),
        solutionReformHr: normalizeDetailScore(aiDetailScores?.solutionReformHr ?? embeddingScores.solutionReformHr),
        collabSupervisor: normalizeDetailScore(aiDetailScores?.collabSupervisor ?? embeddingScores.collabSupervisor),
        collabExternal: normalizeDetailScore(aiDetailScores?.collabExternal ?? embeddingScores.collabExternal),
        collabMember: normalizeDetailScore(aiDetailScores?.collabMember ?? embeddingScores.collabMember),
      };

      // 詳細スコアから主要スコア（problem/solution/collaboration）を計算
      // role/leadership/developmentはAIが直接評価した値を使用
      const calculatedMainScores = calculateMainScoresFromDetailScores(normalizedDetailScores, {
        role: aiResult.scores.role,
        leadership: aiResult.scores.leadership,
        development: aiResult.scores.development,
      });

      predictedScores = {
        // 主要スコア
        // problem/solution/collaboration: 詳細スコアから計算式で算出
        // role/leadership/development: AIが直接評価
        problem: question === 'q1' ? calculatedMainScores.problem : null,
        solution: question === 'q2' ? calculatedMainScores.solution : null,
        role: normalizeMainScore('role', calculatedMainScores.role),
        leadership: question === 'q2' ? normalizeMainScore('leadership', calculatedMainScores.leadership) : null,
        collaboration: question === 'q2' ? normalizeMainScore('collaboration', calculatedMainScores.collaboration) : null,
        development: question === 'q2' ? normalizeMainScore('development', calculatedMainScores.development) : null,
        // 詳細スコア（AIが直接評価）
        ...normalizedDetailScores,
      };
    } else if (!aiResult.isValidAnswer) {
      // AIが無効と判断した場合（詳細スコアは最低値1を設定）
      predictedScores = {
        problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        role: AI_SCORING_CONFIG.invalidAnswerScore,
        leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
        // 詳細スコア（無効な回答は最低値1）
        problemUnderstanding: question === 'q1' ? 1 : null,
        problemEssence: question === 'q1' ? 1 : null,
        problemMaintenanceBiz: question === 'q1' ? 1 : null,
        problemMaintenanceHr: question === 'q1' ? 1 : null,
        problemReformBiz: question === 'q1' ? 1 : null,
        problemReformHr: question === 'q1' ? 1 : null,
        solutionCoverage: question === 'q2' ? 1 : null,
        solutionPlanning: question === 'q2' ? 1 : null,
        solutionMaintenanceBiz: question === 'q2' ? 1 : null,
        solutionMaintenanceHr: question === 'q2' ? 1 : null,
        solutionReformBiz: question === 'q2' ? 1 : null,
        solutionReformHr: question === 'q2' ? 1 : null,
        collabSupervisor: question === 'q2' ? 1 : null,
        collabExternal: question === 'q2' ? 1 : null,
        collabMember: question === 'q2' ? 1 : null,
      };
    }

    explanation = lowSimilarityWarning + aiResult.explanation;
  } else if (earlyCheckResult) {
    // 早期チェックで弾かれた場合（詳細スコアは最低値1を設定）
    predictedScores = {
      problem: question === 'q1' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      solution: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      role: AI_SCORING_CONFIG.invalidAnswerScore,
      leadership: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      collaboration: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      development: question === 'q2' ? AI_SCORING_CONFIG.invalidAnswerScore : null,
      problemUnderstanding: question === 'q1' ? 1 : null,
      problemEssence: question === 'q1' ? 1 : null,
      problemMaintenanceBiz: question === 'q1' ? 1 : null,
      problemMaintenanceHr: question === 'q1' ? 1 : null,
      problemReformBiz: question === 'q1' ? 1 : null,
      problemReformHr: question === 'q1' ? 1 : null,
      solutionCoverage: question === 'q2' ? 1 : null,
      solutionPlanning: question === 'q2' ? 1 : null,
      solutionMaintenanceBiz: question === 'q2' ? 1 : null,
      solutionMaintenanceHr: question === 'q2' ? 1 : null,
      solutionReformBiz: question === 'q2' ? 1 : null,
      solutionReformHr: question === 'q2' ? 1 : null,
      collabSupervisor: question === 'q2' ? 1 : null,
      collabExternal: question === 'q2' ? 1 : null,
      collabMember: question === 'q2' ? 1 : null,
    };
    explanation = earlyCheckWarning + `ケースの状況を踏まえた具体的な回答を記述してください。`;
  } else {
    // AIを使用しない場合も詳細スコアから主要スコアを計算
    const normalizedDetailScores = {
      problemUnderstanding: normalizeDetailScore(embeddingScores.problemUnderstanding),
      problemEssence: normalizeDetailScore(embeddingScores.problemEssence),
      problemMaintenanceBiz: normalizeDetailScore(embeddingScores.problemMaintenanceBiz),
      problemMaintenanceHr: normalizeDetailScore(embeddingScores.problemMaintenanceHr),
      problemReformBiz: normalizeDetailScore(embeddingScores.problemReformBiz),
      problemReformHr: normalizeDetailScore(embeddingScores.problemReformHr),
      solutionCoverage: normalizeDetailScore(embeddingScores.solutionCoverage),
      solutionPlanning: normalizeDetailScore(embeddingScores.solutionPlanning),
      solutionMaintenanceBiz: normalizeDetailScore(embeddingScores.solutionMaintenanceBiz),
      solutionMaintenanceHr: normalizeDetailScore(embeddingScores.solutionMaintenanceHr),
      solutionReformBiz: normalizeDetailScore(embeddingScores.solutionReformBiz),
      solutionReformHr: normalizeDetailScore(embeddingScores.solutionReformHr),
      collabSupervisor: normalizeDetailScore(embeddingScores.collabSupervisor),
      collabExternal: normalizeDetailScore(embeddingScores.collabExternal),
      collabMember: normalizeDetailScore(embeddingScores.collabMember),
    };

    const calculatedMainScores = calculateMainScoresFromDetailScores(normalizedDetailScores);

    predictedScores = {
      problem: question === 'q1' ? calculatedMainScores.problem : null,
      solution: question === 'q2' ? calculatedMainScores.solution : null,
      role: normalizeMainScore('role', calculatedMainScores.role),
      leadership: question === 'q2' ? normalizeMainScore('leadership', calculatedMainScores.leadership) : null,
      collaboration: question === 'q2' ? normalizeMainScore('collaboration', calculatedMainScores.collaboration) : null,
      development: question === 'q2' ? normalizeMainScore('development', calculatedMainScores.development) : null,
      ...normalizedDetailScores,
    };

    explanation = lowSimilarityWarning + generateNewCaseExplanation(predictedScores, similarCases, similarExamples.slice(0, 3), roundedConfidence);
  }

  return {
    predictedScores,
    embeddingScores, // 参考値として表示（AIの最終判断には使用していない）
    confidence: roundedConfidence,
    similarCases,
    similarExamples: similarExamples.slice(0, 3), // UIには上位3件のみ返す
    explanation,
    isValidAnswer,
    earlyCheckResult,
  };
}

// 未知ケース用の説明文を生成
function generateNewCaseExplanation(
  scores: ScoreItems,
  similarCases: SimilarCase[],
  examples: SimilarResponse[],
  confidence: number
): string {
  const representativeScore = scores.problem || scores.solution || 0;
  const scoreLevel = representativeScore >= 3.5 ? '高評価' : representativeScore >= 2.5 ? '中程度' : '低評価';
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


