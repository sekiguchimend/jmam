// ベクトル計算（embedding用）

export type Vector = number[];

export function dot(a: Vector, b: Vector): number {
  let sum = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i += 1) sum += a[i] * b[i];
  return sum;
}

export function norm(a: Vector): number {
  return Math.sqrt(dot(a, a));
}

export function cosineDistance(a: Vector, b: Vector): number {
  const na = norm(a);
  const nb = norm(b);
  if (na === 0 || nb === 0) return 1;
  const cos = dot(a, b) / (na * nb);
  // 0:同一方向, 2:逆方向 を距離として扱う
  return 1 - cos;
}

export function mean(vectors: Vector[]): Vector {
  if (vectors.length === 0) return [];
  const dim = vectors[0]?.length ?? 0;
  const out = new Array<number>(dim).fill(0);
  for (const v of vectors) {
    for (let i = 0; i < dim; i += 1) out[i] += v[i] ?? 0;
  }
  for (let i = 0; i < dim; i += 1) out[i] /= vectors.length;
  return out;
}


