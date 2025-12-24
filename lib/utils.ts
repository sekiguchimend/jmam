// ユーティリティ関数

// CSVパース（ストリーム処理対応）
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

// 日付変換（YYYY-MM-DD形式）
export function parseDate(dateStr: string): string | null {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

// スコア変換（1.0-4.0の範囲）
export function parseScore(value: string): number | null {
  const num = parseFloat(value);
  if (isNaN(num) || num < 1.0 || num > 4.0) return null;
  return Math.round(num * 10) / 10;
}

// バッチ処理用のチャンク分割
export function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
