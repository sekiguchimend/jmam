// CSVアップロード API（SSEで進捗を返す）
// FR-07〜FR-11 / PE-02 / MN-02
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 600; // 10分（Vercel）

import { getAccessToken, isAdmin } from '@/lib/supabase/server';
import { iterateCsvRecordsFromBytes, parseCSVLine, parseDate, parseScore } from '@/lib/utils';
import { upsertCase, upsertResponses } from '@/lib/supabase';
import type { CsvRowData } from '@/types';

const BATCH_SIZE = 1000;
const REQUIRED_HEADERS = ['受注番号', 'Ⅱ　MC　題材コード'];

function dedupeResponsesByKey(rows: CsvRowData[]): { deduped: CsvRowData[]; dropped: number } {
  // upsertのonConflict(case_id,response_id)に対して、同一コマンド内で重複があると
  // "ON CONFLICT DO UPDATE command cannot affect row a second time" になるため、ここで除外する。
  // 方針: 同一キーが複数回出た場合は「最後に出た行」を採用（CSVの後勝ち）
  const map = new Map<string, CsvRowData>();
  for (const row of rows) {
    const key = `${row.case_id}__${row.response_id}`;
    map.set(key, row);
  }
  const deduped = Array.from(map.values());
  return { deduped, dropped: rows.length - deduped.length };
}

function validateHeaders(headers: string[]): { valid: boolean; missing: string[] } {
  const missing = REQUIRED_HEADERS.filter((h) => !headers.includes(h));
  return { valid: missing.length === 0, missing };
}

function parseRow(
  headers: string[],
  values: string[],
  rowIndex: number
): { data: CsvRowData | null; caseName: string | null; error: string | null } {
  const getVal = (key: string) => {
    const idx = headers.indexOf(key);
    return idx >= 0 && idx < values.length ? values[idx]?.trim() ?? '' : '';
  };

  const responseId = getVal('受注番号');
  const caseId = getVal('Ⅱ　MC　題材コード');

  if (!responseId || !caseId) {
    return {
      data: null,
      caseName: null,
      error: `${rowIndex}行目: 必須項目（受注番号またはⅡ　MC　題材コード）が空です`,
    };
  }

  const caseName = getVal('Ⅱ　MC　題材名') || null;

  return {
    data: {
      case_id: caseId,
      response_id: responseId,
      case_name: caseName ?? undefined,
      submitted_at: parseDate(getVal('実施日')) ?? undefined,
      score_overall: parseScore(getVal('Ⅱ　MC　演習総合評点')) ?? undefined,
      score_problem: parseScore(getVal('Ⅱ　MC　問題把握評点')) ?? undefined,
      score_solution: parseScore(getVal('Ⅱ　MC　対策立案評点')) ?? undefined,
      score_role: parseScore(getVal('Ⅱ　MC　役割理解評点')) ?? undefined,
      score_leadership: parseScore(getVal('Ⅱ　MC　主導評点')) ?? undefined,
      score_collaboration: parseScore(getVal('Ⅱ　MC　連携評点')) ?? undefined,
      score_development: parseScore(getVal('Ⅱ　MC　育成評点')) ?? undefined,
      comment_overall: getVal('Ⅱ　MC　総合コメント') || undefined,
      comment_problem: getVal('Ⅱ　MC　問題把握コメント') || undefined,
      comment_solution: getVal('Ⅱ　MC　対策立案コメント') || undefined,
      answer_q1: getVal('【設問ID】　1') || undefined,
      answer_q2: getVal('【設問ID】　2') || undefined,
      answer_q3: getVal('【設問ID】　3') || undefined,
      answer_q4: getVal('【設問ID】　4') || undefined,
      answer_q5: getVal('【設問ID】　5') || undefined,
      answer_q6: getVal('【設問ID】　6') || undefined,
      answer_q7: getVal('【設問ID】　7') || undefined,
      answer_q8: getVal('【設問ID】　8') || undefined,
      answer_q9: getVal('【設問ID】　9') || undefined,
    },
    caseName,
    error: null,
  };
}

async function detectEncodingAndRebuildStream(file: File): Promise<{
  stream: ReadableStream<Uint8Array>;
  encoding: string;
}> {
  // 先頭の少量だけ読んでUTF-8/Shift_JISを判定し、その後に同じストリームを復元してデコードする
  const source = file.stream();
  const reader = source.getReader();
  const prefixChunks: Uint8Array[] = [];
  let prefixBytes = 0;

  while (prefixBytes < 64 * 1024) {
    const { value, done } = await reader.read();
    if (done) break;
    if (value) {
      prefixChunks.push(value);
      prefixBytes += value.byteLength;
    }
    // ヘッダー行が取れそうなら早めに止める（適当な閾値）
    if (prefixBytes >= 8 * 1024) break;
  }

  const concatPrefix = (chunks: Uint8Array[]) => {
    const total = chunks.reduce((acc, c) => acc + c.byteLength, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) {
      out.set(c, offset);
      offset += c.byteLength;
    }
    return out;
  };

  const prefix = concatPrefix(prefixChunks);

  const tryDecode = (encoding: string) => {
    try {
      const dec = new TextDecoder(encoding as never, { fatal: false });
      return dec.decode(prefix);
    } catch {
      return '';
    }
  };

  const utf8 = tryDecode('utf-8');
  const sjis = tryDecode('shift-jis');
  const utf8LooksOk =
    utf8.includes('受注番号') || utf8.includes('題材コード') || utf8.includes('Ⅱ') || utf8.includes('MC');

  const encoding = utf8LooksOk ? 'utf-8' : 'shift-jis';

  // prefix + 残りのストリームを連結
  const rebuilt = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const c of prefixChunks) controller.enqueue(c);
      (async () => {
        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (value) controller.enqueue(value);
          }
          controller.close();
        } catch (e) {
          controller.error(e);
        }
      })();
    },
  });

  // ここではバイトストリームの復元まで。デコードはiterateLinesFromBytesで行う。
  return { stream: rebuilt, encoding };
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: string, data: unknown) =>
        controller.enqueue(encoder.encode(sseEvent(event, data)));

      try {
        if (!(await isAdmin())) {
          send('error', { error: '管理者権限がありません' });
          controller.close();
          return;
        }

        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
          send('error', { error: 'ファイルが選択されていません' });
          controller.close();
          return;
        }

        const fileName = file.name || 'upload.csv';
        send('start', { fileName });

        const adminToken = await getAccessToken();
        if (!adminToken) {
          send('error', { error: '管理者トークンが見つかりません（再ログインしてください）' });
          controller.close();
          return;
        }

        const { stream: byteStream, encoding } = await detectEncodingAndRebuildStream(file);
        const records = iterateCsvRecordsFromBytes(byteStream, encoding);

        let headers: string[] | null = null;
        let recordNo = 0;
        let headerAttempts = 0;

        const caseSeen = new Set<string>();
        let batch: CsvRowData[] = [];
        let processedCount = 0;
        const errors: string[] = [];

        for await (const record of records) {
          recordNo += 1;
          if (!record.trim()) continue;

          if (!headers) {
            const candidate = parseCSVLine(record);
            const headerValidation = validateHeaders(candidate);
            if (headerValidation.valid) {
              headers = candidate;
              continue;
            }

            // 一部CSVは 1行目に項目ID（固定001...）があり、2行目以降が日本語ヘッダーのためスキップを許容
            headerAttempts += 1;
            if (headerAttempts < 5) {
              continue;
            }

            const msg = `必須カラムが見つかりません: ${headerValidation.missing.join(', ')}`;
            console.error('CSV header error:', { fileName, missing: headerValidation.missing });
            send('error', { fileName, error: msg, errors: [msg] });
            controller.close();
            return;
          }

          const values = parseCSVLine(record);
          const result = parseRow(headers, values, recordNo);

          if (result.error) {
            errors.push(result.error);
            console.error('CSV row validation error:', { fileName, recordNo, error: result.error });
            if (errors.length >= 10) {
              send('error', {
                fileName,
                error: '検証エラーが多数あります。最初の10件を表示します。',
                errors,
              });
              controller.close();
              return;
            }
            continue;
          }

          if (!result.data) continue;

          // ケースを先にupsert（FKがあるDBでも安全にする）
          const caseId = result.data.case_id;
          if (!caseSeen.has(caseId)) {
            caseSeen.add(caseId);
            await upsertCase({
              case_id: caseId,
              case_name: result.data.case_name ?? null,
            }, adminToken);
          }

          batch.push(result.data);

          if (batch.length >= BATCH_SIZE) {
            const { deduped, dropped } = dedupeResponsesByKey(batch);
            if (dropped > 0) {
              console.warn('duplicate response keys found in batch; keeping last occurrences', {
                fileName,
                dropped,
              });
            }

            const dbRecords = deduped.map(({ case_name: _caseName, ...rest }) => {
              void _caseName;
              return rest;
            });
            await upsertResponses(dbRecords, adminToken);
            processedCount += batch.length;
            batch = [];

            send('progress', {
              fileName,
              processed: processedCount,
              status: 'processing',
            });
          }
        }

        if (!headers) {
          send('error', { fileName: 'upload.csv', error: 'データが存在しません' });
          controller.close();
          return;
        }

        // 残りをフラッシュ
        if (batch.length > 0) {
          const { deduped, dropped } = dedupeResponsesByKey(batch);
          if (dropped > 0) {
            console.warn('duplicate response keys found in final batch; keeping last occurrences', {
              fileName,
              dropped,
            });
          }

          const dbRecords = deduped.map(({ case_name: _caseName, ...rest }) => {
            void _caseName;
            return rest;
          });
          await upsertResponses(dbRecords, adminToken);
          processedCount += batch.length;
          send('progress', {
            fileName,
            processed: processedCount,
            status: 'processing',
          });
        }

        send('completed', { fileName, processed: processedCount, status: 'completed' });
        controller.close();
      } catch (error) {
        console.error('upload route error:', error);
        controller.enqueue(encoder.encode(sseEvent('error', { error: 'アップロード処理中にエラーが発生しました' })));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}


