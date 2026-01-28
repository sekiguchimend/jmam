/**
 * スコア計算ロジック
 *
 * 詳細スコア（子スコア）から主要スコア（親スコア）を計算するための関数群
 * データ分析に基づいて導出された計算式を使用
 *
 * 参照: docs/SCORE_CALCULATION_LOGIC.md
 */

/**
 * 連携スコア (score_collaboration) を計算
 *
 * 計算式: (上司 + 職場外 + メンバー) ÷ 2 - 0.5
 * 一致率: 約90.3%
 *
 * @param supervisor - 上司との連携 (1-4)
 * @param external - 職場外との連携 (1-4)
 * @param member - メンバーとの連携 (1-4)
 * @returns 連携スコア (1.0-4.0, 0.5刻み)
 */
export function calculateCollaborationScore(
  supervisor: number | null | undefined,
  external: number | null | undefined,
  member: number | null | undefined
): number | null {
  if (supervisor == null || external == null || member == null) {
    return null;
  }

  const sum = supervisor + external + member;
  const raw = sum / 2 - 0.5;

  // 範囲制限 (1.0-4.0) と0.5刻みに丸め
  const clamped = Math.max(1, Math.min(4, raw));
  return Math.round(clamped * 2) / 2;
}

/**
 * 問題把握スコア (score_problem) を計算
 *
 * 基本式: (6項目の合計 ÷ 6 ÷ 4) × 5
 * 丸め条件:
 *   - 理解 >= 3 AND 本質 < 理解 → 切り捨て
 *   - それ以外 → 四捨五入
 * 一致率: 約76.5%
 *
 * @param understanding - 状況理解 (1-4)
 * @param essence - 本質把握 (1-4)
 * @param maintenanceBiz - 維持管理・業務 (1-4)
 * @param maintenanceHr - 維持管理・人 (1-4)
 * @param reformBiz - 改革・業務 (1-4)
 * @param reformHr - 改革・人 (1-4)
 * @returns 問題把握スコア (1.0-5.0, 0.5刻み)
 */
export function calculateProblemScore(
  understanding: number | null | undefined,
  essence: number | null | undefined,
  maintenanceBiz: number | null | undefined,
  maintenanceHr: number | null | undefined,
  reformBiz: number | null | undefined,
  reformHr: number | null | undefined
): number | null {
  if (
    understanding == null ||
    essence == null ||
    maintenanceBiz == null ||
    maintenanceHr == null ||
    reformBiz == null ||
    reformHr == null
  ) {
    return null;
  }

  const sum = understanding + essence + maintenanceBiz + maintenanceHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;

  // 丸め条件: 理解>=3 かつ 本質<理解 → 切り捨て
  let result: number;
  if (understanding >= 3 && essence < understanding) {
    result = Math.floor(raw / 0.5) * 0.5;
  } else {
    result = Math.round(raw / 0.5) * 0.5;
  }

  // 範囲制限 (1.0-5.0)
  return Math.max(1, Math.min(5, result));
}

/**
 * 対策立案スコア (score_solution) を計算
 *
 * 基本式: (6項目の合計 ÷ 6 ÷ 4) × 5
 * 丸め条件:
 *   - 網羅性 >= 3 AND 計画性 <= 2 → 切り捨て
 *   - それ以外 → 四捨五入
 * 一致率: 約73.2%
 *
 * @param coverage - 網羅性 (1-4)
 * @param planning - 計画性 (1-4)
 * @param maintenanceBiz - 維持管理・業務 (1-4)
 * @param maintenanceHr - 維持管理・人 (1-4)
 * @param reformBiz - 改革・業務 (1-4)
 * @param reformHr - 改革・人 (1-4)
 * @returns 対策立案スコア (1.0-5.0, 0.5刻み)
 */
export function calculateSolutionScore(
  coverage: number | null | undefined,
  planning: number | null | undefined,
  maintenanceBiz: number | null | undefined,
  maintenanceHr: number | null | undefined,
  reformBiz: number | null | undefined,
  reformHr: number | null | undefined
): number | null {
  if (
    coverage == null ||
    planning == null ||
    maintenanceBiz == null ||
    maintenanceHr == null ||
    reformBiz == null ||
    reformHr == null
  ) {
    return null;
  }

  const sum = coverage + planning + maintenanceBiz + maintenanceHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;

  // 丸め条件: 網羅性>=3 かつ 計画性<=2 → 切り捨て
  let result: number;
  if (coverage >= 3 && planning <= 2) {
    result = Math.floor(raw / 0.5) * 0.5;
  } else {
    result = Math.round(raw / 0.5) * 0.5;
  }

  // 範囲制限 (1.0-5.0)
  return Math.max(1, Math.min(5, result));
}

/**
 * 詳細スコアから全ての主要スコアを計算
 *
 * 注意: role, leadership, development は詳細スコアがないため、
 * この関数では計算できません（nullが返されます）
 *
 * @param detailScores - 詳細スコアオブジェクト
 * @returns 計算された主要スコア
 */
export function calculateMainScoresFromDetails(detailScores: {
  // 問題把握の詳細
  problemUnderstanding?: number | null;
  problemEssence?: number | null;
  problemMaintenanceBiz?: number | null;
  problemMaintenanceHr?: number | null;
  problemReformBiz?: number | null;
  problemReformHr?: number | null;
  // 対策立案の詳細
  solutionCoverage?: number | null;
  solutionPlanning?: number | null;
  solutionMaintenanceBiz?: number | null;
  solutionMaintenanceHr?: number | null;
  solutionReformBiz?: number | null;
  solutionReformHr?: number | null;
  // 連携の詳細
  collabSupervisor?: number | null;
  collabExternal?: number | null;
  collabMember?: number | null;
}): {
  problem: number | null;
  solution: number | null;
  collaboration: number | null;
  role: number | null;
  leadership: number | null;
  development: number | null;
} {
  // 問題把握を計算
  const problem = calculateProblemScore(
    detailScores.problemUnderstanding,
    detailScores.problemEssence,
    detailScores.problemMaintenanceBiz,
    detailScores.problemMaintenanceHr,
    detailScores.problemReformBiz,
    detailScores.problemReformHr
  );

  // 対策立案を計算
  const solution = calculateSolutionScore(
    detailScores.solutionCoverage,
    detailScores.solutionPlanning,
    detailScores.solutionMaintenanceBiz,
    detailScores.solutionMaintenanceHr,
    detailScores.solutionReformBiz,
    detailScores.solutionReformHr
  );

  // 連携を計算
  const collaboration = calculateCollaborationScore(
    detailScores.collabSupervisor,
    detailScores.collabExternal,
    detailScores.collabMember
  );

  // 役割理解、主導、育成は詳細スコアがないため計算不可
  // これらは別途AI予測または他の主要スコアから推定する必要がある
  return {
    problem,
    solution,
    collaboration,
    role: null,        // 詳細スコアなし
    leadership: null,  // 詳細スコアなし
    development: null, // 詳細スコアなし
  };
}

/**
 * 主要スコアから役割理解を計算
 *
 * 式: (主導 + 連携 + 育成) ÷ 3
 * 役割理解は主導・連携・育成の平均として定義される
 *
 * @param leadership - 主導スコア (1-4)
 * @param collaboration - 連携スコア (1-4)
 * @param development - 育成スコア (1-4)
 * @returns 役割理解スコア (1.0-4.0, 小数点1桁)
 */
export function calculateRoleScore(
  leadership: number | null | undefined,
  collaboration: number | null | undefined,
  development: number | null | undefined
): number | null {
  if (leadership == null || collaboration == null || development == null) {
    return null;
  }

  const raw = (leadership + collaboration + development) / 3;
  // 役割理解は0.1刻み
  return Math.round(raw * 10) / 10;
}

/**
 * @deprecated Use calculateRoleScore instead
 * 後方互換性のためのエイリアス
 */
export function estimateRoleScore(
  collaboration: number | null | undefined,
  leadership: number | null | undefined,
  development?: number | null | undefined
): number | null {
  // 旧APIとの互換性: developmentが提供されない場合は2.5をデフォルトとする
  const dev = development ?? 2.5;
  return calculateRoleScore(leadership, collaboration, dev);
}

/**
 * 対策立案スコアから主導を推定（参考値）
 *
 * 注意: この計算は一致率が低い（約47%）ため、参考値として使用
 * 主導スコアは対策立案スコアとほぼ相関
 *
 * @param solution - 対策立案スコア
 * @returns 主導スコア（推定値）
 */
export function estimateLeadershipScore(
  solution: number | null | undefined
): number | null {
  if (solution == null) {
    return null;
  }

  // 対策立案を主導の範囲(1-4)に調整
  const adjusted = Math.min(4, solution);
  // 0.5刻みに丸め
  return Math.round(adjusted * 2) / 2;
}

/**
 * 対策立案の詳細から育成を推定（参考値）
 *
 * 注意: この計算は一致率が低い（約54.2%）ため、参考値として使用
 * 式: 対策立案の維持管理・人 + 0.5
 *
 * @param solutionMaintenanceHr - 対策立案の維持管理・人
 * @returns 育成スコア（推定値）
 */
export function estimateDevelopmentScore(
  solutionMaintenanceHr: number | null | undefined
): number | null {
  if (solutionMaintenanceHr == null) {
    return null;
  }

  const raw = solutionMaintenanceHr + 0.5;
  // 育成は0.5刻み、上限4
  const clamped = Math.max(1, Math.min(4, raw));
  return Math.round(clamped * 2) / 2;
}
