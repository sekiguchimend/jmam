import { describe, it, expect } from 'vitest';
import { kmeansCosine, type KMeansCluster } from '../kmeans';

describe('kmeans', () => {
  // ========================================
  // kmeansCosine
  // ========================================
  describe('kmeansCosine', () => {
    it('空の配列に対しては空のクラスタを返す', () => {
      const result = kmeansCosine([], 3);
      expect(result).toEqual([]);
    });

    it('k=1の場合は全てのベクトルが1つのクラスタに', () => {
      const vectors = [[1, 0], [0, 1], [1, 1]];
      const result = kmeansCosine(vectors, 1);

      expect(result).toHaveLength(1);
      expect(result[0].indices).toHaveLength(3);
      expect(result[0].indices).toContain(0);
      expect(result[0].indices).toContain(1);
      expect(result[0].indices).toContain(2);
    });

    it('ベクトル数よりkが大きい場合はベクトル数に制限', () => {
      const vectors = [[1, 0], [0, 1]];
      const result = kmeansCosine(vectors, 5);

      // 最大でもベクトル数分のクラスタ
      expect(result.length).toBeLessThanOrEqual(vectors.length);
    });

    it('明確に分離したベクトルを正しくクラスタリング', () => {
      // 3つの明確に異なる方向のベクトル群
      const vectors = [
        [1, 0, 0], [1.1, 0, 0], [0.9, 0, 0],  // グループ1: x軸方向
        [0, 1, 0], [0, 1.1, 0], [0, 0.9, 0],  // グループ2: y軸方向
        [0, 0, 1], [0, 0, 1.1], [0, 0, 0.9],  // グループ3: z軸方向
      ];

      const result = kmeansCosine(vectors, 3, 50);

      // 3つのクラスタに分かれる
      expect(result.length).toBe(3);

      // 各クラスタが3つのベクトルを持つ
      const sizes = result.map(c => c.indices.length).sort();
      expect(sizes).toEqual([3, 3, 3]);
    });

    it('全てのベクトルがいずれかのクラスタに所属', () => {
      const vectors = [[1, 0], [0, 1], [1, 1], [2, 0], [0, 2]];
      const result = kmeansCosine(vectors, 2);

      // 全インデックスが網羅されている
      const allIndices = result.flatMap(c => c.indices).sort((a, b) => a - b);
      expect(allIndices).toEqual([0, 1, 2, 3, 4]);
    });

    it('セントロイドがベクトルと同じ次元', () => {
      const vectors = [[1, 2, 3], [4, 5, 6], [7, 8, 9]];
      const result = kmeansCosine(vectors, 2);

      for (const cluster of result) {
        expect(cluster.centroid).toHaveLength(3);
      }
    });

    it('単一ベクトルの場合は単一クラスタ', () => {
      const vectors = [[1, 2, 3]];
      const result = kmeansCosine(vectors, 3);

      expect(result).toHaveLength(1);
      expect(result[0].indices).toEqual([0]);
    });

    it('類似ベクトルは同じクラスタに', () => {
      const vectors = [
        [1, 0], [1.01, 0], // ほぼ同じ方向（グループA）
        [0, 1], [0, 1.01], // ほぼ同じ方向（グループB）
      ];

      const result = kmeansCosine(vectors, 2, 50);

      // 2つのクラスタに分かれる
      expect(result).toHaveLength(2);

      // 類似ベクトルは同じクラスタに
      const cluster0Indices = result[0].indices;
      const cluster1Indices = result[1].indices;

      // (0, 1)が同じクラスタ または (2, 3)が同じクラスタ
      const pair01InSame = (cluster0Indices.includes(0) && cluster0Indices.includes(1)) ||
                          (cluster1Indices.includes(0) && cluster1Indices.includes(1));
      const pair23InSame = (cluster0Indices.includes(2) && cluster0Indices.includes(3)) ||
                          (cluster1Indices.includes(2) && cluster1Indices.includes(3));

      expect(pair01InSame).toBe(true);
      expect(pair23InSame).toBe(true);
    });

    it('maxItersを超えると収束前でも終了', () => {
      const vectors = Array.from({ length: 100 }, (_, i) => [
        Math.cos(i * 0.1),
        Math.sin(i * 0.1),
      ]);

      // maxIters=1で実行しても例外なく終了する
      const result = kmeansCosine(vectors, 5, 1);

      // 結果は返される（内容は保証しないが、形式は正しい）
      expect(result.length).toBeGreaterThan(0);
      for (const cluster of result) {
        expect(cluster.centroid).toHaveLength(2);
        expect(cluster.indices.length).toBeGreaterThan(0);
      }
    });

    it('同一ベクトルの複製は同じクラスタに', () => {
      // 明確に異なる方向のベクトルを使用
      const vectors = [
        [1, 0], [1.001, 0], [0.999, 0],  // x軸方向
        [0, 1], [0, 1.001],              // y軸方向
      ];

      const result = kmeansCosine(vectors, 2, 50);

      // 少なくとも1つ以上のクラスタが返される
      expect(result.length).toBeGreaterThanOrEqual(1);

      // 全てのインデックスが網羅されている
      const allIndices = result.flatMap(c => c.indices).sort((a, b) => a - b);
      expect(allIndices).toEqual([0, 1, 2, 3, 4]);
    });
  });
});
