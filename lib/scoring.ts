// スコア関連ユーティリティ
// スコア帯（例: 3.5点帯）を0.5刻みで扱う

export function toScoreBucket(score: number): number {
  if (!Number.isFinite(score)) return 0;
  const clamped = Math.min(5, Math.max(0, score));
  return Math.round(clamped * 2) / 2;
}


