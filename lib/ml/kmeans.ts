import { cosineDistance, mean, type Vector } from './vector';

export type KMeansCluster = {
  centroid: Vector;
  indices: number[];
};

function pickInitialCentroids(vectors: Vector[], k: number): Vector[] {
  // シンプルな初期化（等間隔サンプリング）
  const n = vectors.length;
  if (n === 0) return [];
  const out: Vector[] = [];
  const step = Math.max(1, Math.floor(n / k));
  for (let i = 0; i < k; i += 1) {
    out.push(vectors[Math.min(n - 1, i * step)]);
  }
  return out;
}

export function kmeansCosine(
  vectors: Vector[],
  k: number,
  maxIters: number = 20
): KMeansCluster[] {
  const n = vectors.length;
  if (n === 0) return [];
  const kk = Math.max(1, Math.min(k, n));

  let centroids = pickInitialCentroids(vectors, kk);
  const assignments = new Array<number>(n).fill(0);

  for (let iter = 0; iter < maxIters; iter += 1) {
    let changed = 0;

    // assignment
    for (let i = 0; i < n; i += 1) {
      const v = vectors[i];
      let best = 0;
      let bestDist = Number.POSITIVE_INFINITY;
      for (let c = 0; c < kk; c += 1) {
        const d = cosineDistance(v, centroids[c]);
        if (d < bestDist) {
          bestDist = d;
          best = c;
        }
      }
      if (assignments[i] !== best) {
        assignments[i] = best;
        changed += 1;
      }
    }

    // update
    const buckets: Vector[][] = Array.from({ length: kk }, () => []);
    for (let i = 0; i < n; i += 1) {
      buckets[assignments[i]].push(vectors[i]);
    }
    const newCentroids: Vector[] = [];
    for (let c = 0; c < kk; c += 1) {
      if (buckets[c].length === 0) {
        // 空クラスタは適当に既存点を再利用
        newCentroids.push(vectors[c % n]);
      } else {
        newCentroids.push(mean(buckets[c]));
      }
    }
    centroids = newCentroids;

    if (changed === 0) break;
  }

  const clusters: KMeansCluster[] = Array.from({ length: kk }, (_, idx) => ({
    centroid: centroids[idx],
    indices: [],
  }));
  for (let i = 0; i < n; i += 1) clusters[assignments[i]].indices.push(i);
  return clusters.filter((c) => c.indices.length > 0);
}


