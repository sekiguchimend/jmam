// ユーティリティ関数

// CSVパース（ストリーム処理対応）
export function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const char = line[i] ?? '';
    if (char === '"') {
      // クォート内のエスケープ（"" -> "）
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }
    if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
      i += 1;
      continue;
    }
    current += char;
    i += 1;
  }
  result.push(current.trim());
  return result;
}

// CSVレコード（行）をストリームから取り出す
// - RFC4180相当: ダブルクォート内の改行を許容
// - ダブルクォートのエスケープ（""）を考慮
export async function* iterateCsvRecordsFromBytes(
  stream: ReadableStream<Uint8Array>,
  encoding: string
): AsyncGenerator<string> {
  const reader = stream.getReader();
  let decoder: TextDecoder;
  try {
    decoder = new TextDecoder(encoding as never, { fatal: false });
  } catch {
    decoder = new TextDecoder('utf-8', { fatal: false });
  }

  let inQuotes = false;
  let record = '';
  let carry = '';

  const process = async function* (text: string): AsyncGenerator<string> {
    let i = 0;
    while (i < text.length) {
      const ch = text[i] ?? '';

      if (ch === '"') {
        // チャンク末尾の " は次チャンクと合わせて判断したい（"" の可能性）
        if (inQuotes && i + 1 >= text.length) {
          carry = '"';
          return;
        }

        if (inQuotes && text[i + 1] === '"') {
          record += '"';
          i += 2;
          continue;
        }

        inQuotes = !inQuotes;
        i += 1;
        continue;
      }

      if (ch === '\n' && !inQuotes) {
        const out = record.endsWith('\r') ? record.slice(0, -1) : record;
        record = '';
        i += 1;
        yield out;
        continue;
      }

      record += ch;
      i += 1;
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;

    const decoded = decoder.decode(value, { stream: true });
    const chunk = carry ? carry + decoded : decoded;
    carry = '';
    yield* process(chunk);
  }

  const tail = (carry ? carry : '') + decoder.decode();
  carry = '';
  if (tail) {
    yield* process(tail);
  }

  // 末尾に改行がなくても最後のレコードを返す
  if (record.length > 0) {
    yield record.endsWith('\r') ? record.slice(0, -1) : record;
  }
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
