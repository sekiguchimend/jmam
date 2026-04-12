import { describe, it, expect } from 'vitest';
import {
  calculateCollaborationScore,
  calculateProblemScore,
  calculateSolutionScore,
  calculateMainScoresFromDetails,
  calculateRoleScore,
  calculateOverallScore,
  estimateLeadershipScore,
  estimateDevelopmentScore,
} from '../score-calculation';

describe('score-calculation', () => {
  // ========================================
  // calculateCollaborationScore
  // ========================================
  describe('calculateCollaborationScore', () => {
    it('正常なスコアを計算', () => {
      // (3 + 3 + 3) / 2 - 0.5 = 4.0
      expect(calculateCollaborationScore(3, 3, 3)).toBe(4.0);
    });

    it('最小スコアを計算', () => {
      // (1 + 1 + 1) / 2 - 0.5 = 1.0
      expect(calculateCollaborationScore(1, 1, 1)).toBe(1.0);
    });

    it('最大スコアを計算', () => {
      // (4 + 4 + 4) / 2 - 0.5 = 5.5 → 5.0（上限）
      expect(calculateCollaborationScore(4, 4, 4)).toBe(5.0);
    });

    it('0.5刻みに丸める', () => {
      // (2 + 3 + 2) / 2 - 0.5 = 3.0
      expect(calculateCollaborationScore(2, 3, 2)).toBe(3.0);
      // (2 + 2 + 3) / 2 - 0.5 = 3.0
      expect(calculateCollaborationScore(2, 2, 3)).toBe(3.0);
    });

    it('nullが含まれる場合はnullを返す', () => {
      expect(calculateCollaborationScore(null, 3, 3)).toBeNull();
      expect(calculateCollaborationScore(3, null, 3)).toBeNull();
      expect(calculateCollaborationScore(3, 3, null)).toBeNull();
    });

    it('undefinedが含まれる場合はnullを返す', () => {
      expect(calculateCollaborationScore(undefined, 3, 3)).toBeNull();
    });
  });

  // ========================================
  // calculateProblemScore
  // ========================================
  describe('calculateProblemScore', () => {
    it('正常なスコアを計算', () => {
      // (3+3+3+3+3+3) / 6 / 4 * 5 = 3.75 → 四捨五入 → 4.0
      expect(calculateProblemScore(3, 3, 3, 3, 3, 3)).toBe(4.0);
    });

    it('最小スコアを計算', () => {
      // (1+1+1+1+1+1) / 6 / 4 * 5 = 1.25 → 四捨五入 → 1.5
      expect(calculateProblemScore(1, 1, 1, 1, 1, 1)).toBe(1.5);
    });

    it('最大スコアを計算', () => {
      // (4+4+4+4+4+4) / 6 / 4 * 5 = 5.0
      expect(calculateProblemScore(4, 4, 4, 4, 4, 4)).toBe(5.0);
    });

    it('丸め条件（理解>=3 かつ 本質<理解）で切り捨て', () => {
      // understanding=3, essence=2 → 切り捨て条件を満たす
      // (3+2+3+3+3+3) / 6 / 4 * 5 = 3.54... → 切り捨て → 3.5
      expect(calculateProblemScore(3, 2, 3, 3, 3, 3)).toBe(3.5);
    });

    it('丸め条件を満たさない場合は四捨五入', () => {
      // understanding=2, essence=3 → 条件を満たさない
      // (2+3+3+3+3+3) / 6 / 4 * 5 = 3.54... → 四捨五入 → 3.5
      expect(calculateProblemScore(2, 3, 3, 3, 3, 3)).toBe(3.5);
    });

    it('nullが含まれる場合はnullを返す', () => {
      expect(calculateProblemScore(null, 3, 3, 3, 3, 3)).toBeNull();
      expect(calculateProblemScore(3, null, 3, 3, 3, 3)).toBeNull();
    });
  });

  // ========================================
  // calculateSolutionScore
  // ========================================
  describe('calculateSolutionScore', () => {
    it('正常なスコアを計算', () => {
      // (3+3+3+3+3+3) / 6 / 4 * 5 = 3.75 → 四捨五入 → 4.0
      expect(calculateSolutionScore(3, 3, 3, 3, 3, 3)).toBe(4.0);
    });

    it('最小スコアを計算', () => {
      // (1+1+1+1+1+1) / 6 / 4 * 5 = 1.25 → 四捨五入 → 1.5
      expect(calculateSolutionScore(1, 1, 1, 1, 1, 1)).toBe(1.5);
    });

    it('最大スコアを計算', () => {
      // (4+4+4+4+4+4) / 6 / 4 * 5 = 5.0
      expect(calculateSolutionScore(4, 4, 4, 4, 4, 4)).toBe(5.0);
    });

    it('丸め条件（網羅性>=3 かつ 計画性<=2）で切り捨て', () => {
      // coverage=3, planning=2 → 切り捨て条件を満たす
      // (3+2+3+3+3+3) / 6 / 4 * 5 = 3.54... → 切り捨て → 3.5
      expect(calculateSolutionScore(3, 2, 3, 3, 3, 3)).toBe(3.5);
    });

    it('丸め条件を満たさない場合は四捨五入', () => {
      // coverage=2, planning=3 → 条件を満たさない
      expect(calculateSolutionScore(2, 3, 3, 3, 3, 3)).toBe(3.5);
    });

    it('nullが含まれる場合はnullを返す', () => {
      expect(calculateSolutionScore(null, 3, 3, 3, 3, 3)).toBeNull();
    });
  });

  // ========================================
  // calculateMainScoresFromDetails
  // ========================================
  describe('calculateMainScoresFromDetails', () => {
    it('全ての詳細スコアから主要スコアを計算', () => {
      const result = calculateMainScoresFromDetails({
        problemUnderstanding: 3,
        problemEssence: 3,
        problemMaintenanceBiz: 3,
        problemMaintenanceHr: 3,
        problemReformBiz: 3,
        problemReformHr: 3,
        solutionCoverage: 3,
        solutionPlanning: 3,
        solutionMaintenanceBiz: 3,
        solutionMaintenanceHr: 3,
        solutionReformBiz: 3,
        solutionReformHr: 3,
        collabSupervisor: 3,
        collabExternal: 3,
        collabMember: 3,
      });

      expect(result.problem).toBe(4.0);
      expect(result.solution).toBe(4.0);
      expect(result.collaboration).toBe(4.0);
      // role, leadership, developmentは詳細スコアがないためnull
      expect(result.role).toBeNull();
      expect(result.leadership).toBeNull();
      expect(result.development).toBeNull();
    });

    it('一部の詳細スコアが欠けている場合は対応する主要スコアがnull', () => {
      const result = calculateMainScoresFromDetails({
        problemUnderstanding: 3,
        // problemEssence欠如
        problemMaintenanceBiz: 3,
        problemMaintenanceHr: 3,
        problemReformBiz: 3,
        problemReformHr: 3,
        solutionCoverage: 3,
        solutionPlanning: 3,
        solutionMaintenanceBiz: 3,
        solutionMaintenanceHr: 3,
        solutionReformBiz: 3,
        solutionReformHr: 3,
        collabSupervisor: 3,
        collabExternal: 3,
        collabMember: 3,
      });

      expect(result.problem).toBeNull(); // 欠けているためnull
      expect(result.solution).toBe(4.0);
      expect(result.collaboration).toBe(4.0);
    });
  });

  // ========================================
  // calculateRoleScore
  // ========================================
  describe('calculateRoleScore', () => {
    it('役割理解スコアを計算（3スコアの平均）', () => {
      // (3 + 4 + 2) / 3 = 3.0
      expect(calculateRoleScore(3, 4, 2)).toBe(3.0);
    });

    it('0.1刻みに丸める', () => {
      // (3 + 3 + 4) / 3 = 3.333... → 3.3
      expect(calculateRoleScore(3, 3, 4)).toBe(3.3);
    });

    it('nullが含まれる場合はnullを返す', () => {
      expect(calculateRoleScore(null, 3, 3)).toBeNull();
      expect(calculateRoleScore(3, null, 3)).toBeNull();
      expect(calculateRoleScore(3, 3, null)).toBeNull();
    });
  });

  // ========================================
  // calculateOverallScore
  // ========================================
  describe('calculateOverallScore', () => {
    it('総合スコアを計算（3スコアの平均）', () => {
      // (3 + 4 + 3.5) / 3 = 3.5
      expect(calculateOverallScore(3, 4, 3.5)).toBe(3.5);
    });

    it('0.1刻みに丸める', () => {
      // (3 + 3 + 4) / 3 = 3.333... → 3.3
      expect(calculateOverallScore(3, 3, 4)).toBe(3.3);
    });

    it('nullが含まれる場合はnullを返す', () => {
      expect(calculateOverallScore(null, 3, 3)).toBeNull();
    });
  });

  // ========================================
  // estimateLeadershipScore
  // ========================================
  describe('estimateLeadershipScore', () => {
    it('対策立案スコアから主導を推定', () => {
      expect(estimateLeadershipScore(3.5)).toBe(3.5);
      expect(estimateLeadershipScore(4.0)).toBe(4.0);
    });

    it('0.5刻みに丸める', () => {
      expect(estimateLeadershipScore(3.3)).toBe(3.5);
      expect(estimateLeadershipScore(3.7)).toBe(3.5);
    });

    it('上限5.0を超えない', () => {
      expect(estimateLeadershipScore(5.5)).toBe(5.0);
    });

    it('nullの場合はnullを返す', () => {
      expect(estimateLeadershipScore(null)).toBeNull();
    });
  });

  // ========================================
  // estimateDevelopmentScore
  // ========================================
  describe('estimateDevelopmentScore', () => {
    it('維持管理・人から育成を推定（+0.5）', () => {
      expect(estimateDevelopmentScore(2)).toBe(2.5);
      expect(estimateDevelopmentScore(3)).toBe(3.5);
    });

    it('0.5刻みに丸める', () => {
      expect(estimateDevelopmentScore(2.5)).toBe(3.0);
    });

    it('上限5.0を超えない', () => {
      expect(estimateDevelopmentScore(4.5)).toBe(5.0);
      expect(estimateDevelopmentScore(5)).toBe(5.0);
    });

    it('下限1.0を下回らない', () => {
      expect(estimateDevelopmentScore(0)).toBe(1.0);
    });

    it('nullの場合はnullを返す', () => {
      expect(estimateDevelopmentScore(null)).toBeNull();
    });
  });
});
