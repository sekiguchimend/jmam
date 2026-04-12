import { describe, it, expect } from 'vitest';
import { dot, norm, cosineDistance, mean } from '../vector';

describe('vector', () => {
  // ========================================
  // dot（内積）
  // ========================================
  describe('dot', () => {
    it('同じ長さのベクトルの内積を計算', () => {
      expect(dot([1, 2, 3], [4, 5, 6])).toBe(1 * 4 + 2 * 5 + 3 * 6); // 32
    });

    it('ゼロベクトルとの内積は0', () => {
      expect(dot([1, 2, 3], [0, 0, 0])).toBe(0);
      expect(dot([0, 0, 0], [1, 2, 3])).toBe(0);
    });

    it('単位ベクトル同士の内積', () => {
      expect(dot([1, 0, 0], [1, 0, 0])).toBe(1);
      expect(dot([1, 0, 0], [0, 1, 0])).toBe(0); // 直交
    });

    it('異なる長さのベクトルは短い方に合わせる', () => {
      expect(dot([1, 2], [3, 4, 5])).toBe(1 * 3 + 2 * 4); // 11
      expect(dot([1, 2, 3], [4, 5])).toBe(1 * 4 + 2 * 5); // 14
    });

    it('空のベクトルの内積は0', () => {
      expect(dot([], [])).toBe(0);
      expect(dot([1, 2], [])).toBe(0);
    });

    it('負の値を含むベクトルの内積', () => {
      expect(dot([1, -2, 3], [-1, 2, -3])).toBe(-1 - 4 - 9); // -14
    });
  });

  // ========================================
  // norm（ノルム）
  // ========================================
  describe('norm', () => {
    it('ベクトルのノルム（長さ）を計算', () => {
      expect(norm([3, 4])).toBe(5); // 3^2 + 4^2 = 25, sqrt(25) = 5
    });

    it('単位ベクトルのノルムは1', () => {
      expect(norm([1, 0, 0])).toBe(1);
      expect(norm([0, 1, 0])).toBe(1);
    });

    it('ゼロベクトルのノルムは0', () => {
      expect(norm([0, 0, 0])).toBe(0);
    });

    it('3次元ベクトルのノルム', () => {
      expect(norm([1, 2, 2])).toBe(3); // sqrt(1 + 4 + 4) = 3
    });

    it('空のベクトルのノルムは0', () => {
      expect(norm([])).toBe(0);
    });

    it('負の値を含むベクトルのノルム', () => {
      expect(norm([-3, 4])).toBe(5); // sqrt(9 + 16) = 5
    });
  });

  // ========================================
  // cosineDistance（コサイン距離）
  // ========================================
  describe('cosineDistance', () => {
    it('同じ方向のベクトルの距離は0', () => {
      expect(cosineDistance([1, 0], [2, 0])).toBeCloseTo(0, 10);
      expect(cosineDistance([1, 2, 3], [2, 4, 6])).toBeCloseTo(0, 10);
    });

    it('直交するベクトルの距離は1', () => {
      expect(cosineDistance([1, 0], [0, 1])).toBeCloseTo(1, 10);
    });

    it('逆方向のベクトルの距離は2', () => {
      expect(cosineDistance([1, 0], [-1, 0])).toBeCloseTo(2, 10);
    });

    it('ゼロベクトルとの距離は1', () => {
      expect(cosineDistance([1, 2, 3], [0, 0, 0])).toBe(1);
      expect(cosineDistance([0, 0, 0], [1, 2, 3])).toBe(1);
      expect(cosineDistance([0, 0, 0], [0, 0, 0])).toBe(1);
    });

    it('類似度が高いベクトルは距離が小さい', () => {
      const a = [1, 2, 3];
      const b = [1, 2, 3.1]; // ほぼ同じ
      const c = [3, 2, 1];   // 異なる方向
      expect(cosineDistance(a, b)).toBeLessThan(cosineDistance(a, c));
    });

    it('距離は0から2の範囲', () => {
      const vectors = [
        [[1, 0], [1, 0]],
        [[1, 0], [0, 1]],
        [[1, 0], [-1, 0]],
        [[1, 1, 1], [2, 2, 2]],
        [[1, 2, 3], [-1, -2, -3]],
      ];
      for (const [a, b] of vectors) {
        const d = cosineDistance(a, b);
        // 浮動小数点の誤差を考慮して-1e-10から2+1e-10の範囲をチェック
        expect(d).toBeGreaterThanOrEqual(-1e-10);
        expect(d).toBeLessThanOrEqual(2 + 1e-10);
      }
    });
  });

  // ========================================
  // mean（平均ベクトル）
  // ========================================
  describe('mean', () => {
    it('複数のベクトルの平均を計算', () => {
      const result = mean([[1, 2], [3, 4], [5, 6]]);
      expect(result).toEqual([3, 4]); // (1+3+5)/3, (2+4+6)/3
    });

    it('単一ベクトルの平均は同じベクトル', () => {
      const result = mean([[1, 2, 3]]);
      expect(result).toEqual([1, 2, 3]);
    });

    it('空の配列の平均は空のベクトル', () => {
      const result = mean([]);
      expect(result).toEqual([]);
    });

    it('ゼロベクトルの平均はゼロベクトル', () => {
      const result = mean([[0, 0], [0, 0]]);
      expect(result).toEqual([0, 0]);
    });

    it('負の値を含むベクトルの平均', () => {
      const result = mean([[1, -2], [-1, 2]]);
      expect(result).toEqual([0, 0]);
    });

    it('3次元ベクトルの平均', () => {
      const result = mean([[1, 2, 3], [4, 5, 6]]);
      expect(result).toEqual([2.5, 3.5, 4.5]);
    });
  });
});
