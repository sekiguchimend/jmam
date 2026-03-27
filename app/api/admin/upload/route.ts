// CSVアップロード処理 API（SSEで進捗を返す + DBにジョブ状態を保存）
// Storage不要・FormData直接受信版
// ページを離れても処理は継続し、戻ってきたらジョブ状態を取得可能

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5分（Vercel Pro/Enterprise用）

import { isAdmin } from '@/lib/supabase/server';
import { iterateCsvRecordsFromBytes, parseCSVLine, parseDate, parseScore } from '@/lib/utils';
import { enqueueEmbeddingJobsServiceRole, upsertCaseServiceRole, insertResponsesServiceRole } from '@/lib/supabase';
import type { CsvRowData } from '@/types';
import { toScoreBucket } from '@/lib/scoring';
import { processEmbeddingQueueBatchServiceRole, rebuildTypicalExamplesForBucketServiceRole } from '@/lib/prepare/worker';
import { sanitizeText, stripControlChars, truncateString } from '@/lib/security';
import { updateUploadJobServiceRole, isJobCancelled } from '@/lib/uploadJobUtils';

const BATCH_SIZE = 5000;
const REQUIRED_HEADERS_NORMALIZED = ['受注番号', 'Ⅱ MC 題材コード'];

const normalizeSpaces = (str: string) => str.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();

function validateHeaders(headers: string[]): { valid: boolean; missing: string[] } {
  const normalizedHeaders = headers.map(normalizeSpaces);
  const missing = REQUIRED_HEADERS_NORMALIZED.filter((h) => !normalizedHeaders.includes(h));
  return { valid: missing.length === 0, missing };
}

function parseRow(
  headers: string[],
  values: string[],
  rowIndex: number
): { data: CsvRowData | null; caseName: string | null; error: string | null } {
  const normalizedHeaders = headers.map(normalizeSpaces);

  const getVal = (key: string) => {
    const normalizedKey = normalizeSpaces(key);
    const idx = normalizedHeaders.indexOf(normalizedKey);
    return idx >= 0 && idx < values.length ? values[idx]?.trim() ?? '' : '';
  };

  const sanitizeId = (val: string) => truncateString(stripControlChars(val), 100);
  const sanitizeName = (val: string) => sanitizeText(val, 255);
  const sanitizeComment = (val: string) => sanitizeText(val, 5000);
  const sanitizeAnswer = (val: string) => sanitizeText(val, 10000);

  const responseId = sanitizeId(getVal('受注番号'));
  const caseId = sanitizeId(getVal('Ⅱ MC 題材コード'));

  if (!responseId || !caseId) {
    return {
      data: null,
      caseName: null,
      error: `${rowIndex}行目: 必須項目（受注番号またはⅡ MC 題材コード）が空です`,
    };
  }

  const caseName = sanitizeName(getVal('Ⅱ MC 題材名')) || null;
  const commentProblem =
    sanitizeComment(getVal('Ⅱ MC 問題把握コメント')) ||
    [sanitizeComment(getVal('Ⅱ MC 問題把握コメント1')), sanitizeComment(getVal('Ⅱ MC 問題把握コメント2'))]
      .filter(Boolean)
      .join('\n') ||
    undefined;
  const commentSolution =
    sanitizeComment(getVal('Ⅱ MC 対策立案コメント')) || sanitizeComment(getVal('Ⅱ MC 対策立案コメント1')) || undefined;

  return {
    data: {
      case_id: caseId,
      response_id: responseId,
      case_name: caseName ?? undefined,
      submitted_at: parseDate(getVal('実施日')) ?? undefined,
      score_overall: parseScore(getVal('Ⅱ MC 演習総合評点')) ?? undefined,
      score_problem: parseScore(getVal('Ⅱ MC 問題把握評点')) ?? undefined,
      score_solution: parseScore(getVal('Ⅱ MC 対策立案評点')) ?? undefined,
      score_role: parseScore(getVal('Ⅱ MC 役割理解評点')) ?? undefined,
      score_leadership: parseScore(getVal('Ⅱ MC 主導評点')) ?? undefined,
      score_collaboration: parseScore(getVal('Ⅱ MC 連携評点')) ?? undefined,
      score_development: parseScore(getVal('Ⅱ MC 育成評点')) ?? undefined,
      detail_problem_understanding: parseScore(getVal('Ⅱ MC 問題把握 状況理解')) ?? undefined,
      detail_problem_essence: parseScore(getVal('Ⅱ MC 問題把握 本質把握')) ?? undefined,
      detail_problem_maintenance_biz: parseScore(getVal('Ⅱ MC 問題把握 維持管理 業務の問題')) ?? undefined,
      detail_problem_maintenance_hr: parseScore(getVal('Ⅱ MC 問題把握 維持管理 人の問題')) ?? undefined,
      detail_problem_reform_biz: parseScore(getVal('Ⅱ MC 問題把握 改革 業務の問題')) ?? undefined,
      detail_problem_reform_hr: parseScore(getVal('Ⅱ MC 問題把握 改革 人の問題')) ?? undefined,
      detail_solution_coverage: parseScore(getVal('Ⅱ MC 対策立案 網羅性')) ?? undefined,
      detail_solution_planning: parseScore(getVal('Ⅱ MC 対策立案 計画性')) ?? undefined,
      detail_solution_maintenance_biz: parseScore(getVal('Ⅱ MC 対策立案 維持管理 業務の問題')) ?? undefined,
      detail_solution_maintenance_hr: parseScore(getVal('Ⅱ MC 対策立案 維持管理 人の問題')) ?? undefined,
      detail_solution_reform_biz: parseScore(getVal('Ⅱ MC 対策立案 改革 業務の問題')) ?? undefined,
      detail_solution_reform_hr: parseScore(getVal('Ⅱ MC 対策立案 改革 人の問題')) ?? undefined,
      detail_collab_supervisor: parseScore(getVal('Ⅱ MC 連携 上司')) ?? undefined,
      detail_collab_external: parseScore(getVal('Ⅱ MC 連携 職場外')) ?? undefined,
      detail_collab_member: parseScore(getVal('Ⅱ MC 連携 メンバー')) ?? undefined,
      comment_overall: sanitizeComment(getVal('Ⅱ MC 総合コメント')) || undefined,
      comment_problem: commentProblem,
      comment_solution: commentSolution,
      answer_q1: sanitizeAnswer(getVal('【設問ID】　1')) || undefined,
      answer_q2: sanitizeAnswer(getVal('【設問ID】　2')) || undefined,
      answer_q3: sanitizeAnswer(getVal('【設問ID】　3')) || undefined,
      answer_q4: sanitizeAnswer(getVal('【設問ID】　4')) || undefined,
      answer_q5: sanitizeAnswer(getVal('【設問ID】　5')) || undefined,
      answer_q6: sanitizeAnswer(getVal('【設問ID】　6')) || undefined,
      answer_q7: sanitizeAnswer(getVal('【設問ID】　7')) || undefined,
      answer_q8: sanitizeAnswer(getVal('【設問ID】　8')) || undefined,
      answer_q9: sanitizeAnswer(getVal('【設問ID】　9')) || undefined,
    },
    caseName,
    error: null,
  };
}

function sseEvent(event: string, data: unknown) {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// FormDataを直接受け取り、SSEで進捗を配信
// ジョブIDをクエリパラメータで受け取り、進捗をDBに保存
export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const url = new URL(request.url);
  const jobId = url.searchParams.get('jobId');

  // SSE接続が切れてもエラーにならないようにする
  let sseConnected = true;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      // SSE送信（接続が切れていてもエラーにしない）
      const send = (event: string, data: unknown) => {
        if (!sseConnected) return;
        try {
          controller.enqueue(encoder.encode(sseEvent(event, data)));
        } catch {
          sseConnected = false;
        }
      };

      // ジョブ更新ヘルパー（DBに進捗を保存 - Service Role版）
      const updateJob = async (updates: Parameters<typeof updateUploadJobServiceRole>[1]) => {
        if (!jobId) return;
        try {
          await updateUploadJobServiceRole(jobId, updates);
        } catch (err) {
          console.error('updateJob error:', err);
        }
      };

      try {
        // 認証チェック
        if (!(await isAdmin())) {
          send('error', { error: '管理者権限がありません' });
          controller.close();
          return;
        }

        // FormDataからファイルを取得
        const formData = await request.formData();
        const file = formData.get('file');

        if (!(file instanceof File)) {
          send('error', { error: 'ファイルが選択されていません' });
          await updateJob({ status: 'error', error_message: 'ファイルが選択されていません' });
          controller.close();
          return;
        }

        if (!file.name.endsWith('.csv')) {
          send('error', { error: 'CSVファイルのみアップロード可能です' });
          await updateJob({ status: 'error', error_message: 'CSVファイルのみアップロード可能です' });
          controller.close();
          return;
        }

        const maxSize = 100 * 1024 * 1024;
        if (file.size > maxSize) {
          send('error', { error: 'ファイルサイズが100MBを超えています' });
          await updateJob({ status: 'error', error_message: 'ファイルサイズが100MBを超えています' });
          controller.close();
          return;
        }

        const fileName = file.name;
        send('start', { fileName, jobId });

        // ジョブを処理中に更新
        await updateJob({ status: 'processing' });

        // ファイルをバイト配列に変換
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);

        // エンコーディング検出
        const detectEncoding = (bytes: Uint8Array): string => {
          const prefix = bytes.slice(0, Math.min(64 * 1024, bytes.length));
          const tryDecode = (encoding: string) => {
            try {
              return new TextDecoder(encoding as never, { fatal: false }).decode(prefix);
            } catch {
              return '';
            }
          };
          const utf8 = tryDecode('utf-8');
          const utf8LooksOk =
            utf8.includes('受注番号') || utf8.includes('題材コード') || utf8.includes('Ⅱ') || utf8.includes('MC');
          return utf8LooksOk ? 'utf-8' : 'shift-jis';
        };

        const encoding = detectEncoding(uint8Array);

        // ReadableStreamに変換
        const byteStream = new ReadableStream<Uint8Array>({
          start(ctrl) {
            ctrl.enqueue(uint8Array);
            ctrl.close();
          },
        });

        const records = iterateCsvRecordsFromBytes(byteStream, encoding);

        let headers: string[] | null = null;
        let recordNo = 0;
        let headerAttempts = 0;

        const caseSeen = new Set<string>();
        const touchedBuckets = new Set<string>();
        let batch: CsvRowData[] = [];
        let processedCount = 0;
        const errors: string[] = [];

        // CSV解析
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

            headerAttempts += 1;
            if (headerAttempts < 5) continue;

            const msg = `必須カラムが見つかりません: ${headerValidation.missing.join(', ')}`;
            send('error', { fileName, error: msg, errors: [msg] });
            await updateJob({ status: 'error', error_message: msg, errors: [msg] });
            controller.close();
            return;
          }

          const values = parseCSVLine(record);
          const result = parseRow(headers, values, recordNo);

          if (result.error) {
            errors.push(result.error);
            if (errors.length >= 10) {
              const msg = '検証エラーが多数あります。最初の10件を表示します。';
              send('error', { fileName, error: msg, errors });
              await updateJob({ status: 'error', error_message: msg, errors });
              controller.close();
              return;
            }
            continue;
          }

          if (!result.data) continue;

          // ケースをupsert（Service Role版）
          const caseId = result.data.case_id;
          if (!caseSeen.has(caseId)) {
            caseSeen.add(caseId);
            await upsertCaseServiceRole({
              case_id: caseId,
              case_name: result.data.case_name ?? null,
              file_name: fileName,
            });
          }

          batch.push(result.data);

          if (batch.length >= BATCH_SIZE) {
            // キャンセル確認
            if (jobId && await isJobCancelled(jobId)) {
              send('cancelled', { status: 'cancelled' });
              controller.close();
              return;
            }

            await flushBatchServiceRole(batch, touchedBuckets);
            processedCount += batch.length;
            batch = [];

            send('progress', {
              fileName,
              processed: processedCount,
              status: 'processing',
            });

            // DBにも進捗を保存
            await updateJob({ processed_rows: processedCount });
          }
        }

        // 最終キャンセル確認
        if (jobId && await isJobCancelled(jobId)) {
          send('cancelled', { status: 'cancelled' });
          controller.close();
          return;
        }

        if (!headers) {
          send('error', { fileName: 'upload.csv', error: 'データが存在しません' });
          await updateJob({ status: 'error', error_message: 'データが存在しません' });
          controller.close();
          return;
        }

        // 残りをフラッシュ
        if (batch.length > 0) {
          await flushBatchServiceRole(batch, touchedBuckets);
          processedCount += batch.length;

          send('progress', {
            fileName,
            processed: processedCount,
            status: 'processing',
          });

          // DBにも進捗を保存
          await updateJob({ processed_rows: processedCount });
        }

        // アップロード完了
        send('completed', { fileName, processed: processedCount, status: 'completed' });

        // DBにも完了を保存（事前準備はまだ）
        await updateJob({
          processed_rows: processedCount,
          total_rows: processedCount,
          prepare_status: 'processing',
        });

        // エンベディング処理開始
        send('prepare_start', { status: 'started' });

        let totalProcessed = 0;
        let totalSucceeded = 0;
        let totalFailed = 0;

        // キャンセル確認用
        let cancelled = false;
        const checkCancelled = async () => {
          if (jobId && await isJobCancelled(jobId)) {
            cancelled = true;
            return true;
          }
          return false;
        };

        // eslint-disable-next-line no-constant-condition
        while (true) {
          // キャンセル確認
          if (await checkCancelled()) {
            send('cancelled', { status: 'cancelled' });
            controller.close();
            return;
          }

          const res = await processEmbeddingQueueBatchServiceRole(50);
          if (res.processed === 0) break;
          totalProcessed += res.processed;
          totalSucceeded += res.succeeded;
          totalFailed += res.failed;

          send('prepare_progress', {
            phase: 'embeddings',
            processed: totalProcessed,
            succeeded: totalSucceeded,
            failed: totalFailed,
          });

          // DBにも進捗を保存
          await updateJob({
            embedding_processed: totalProcessed,
            embedding_succeeded: totalSucceeded,
            embedding_failed: totalFailed,
          });
        }

        if (cancelled) {
          controller.close();
          return;
        }

        // 典型例再計算
        const items = Array.from(touchedBuckets.values()).slice(0, 200);
        let typicalDone = 0;

        // DBに典型例の総数を保存
        await updateJob({ typicals_total: items.length });

        for (const key of items) {
          // キャンセル確認（10件ごと）
          if (typicalDone % 10 === 0 && await checkCancelled()) {
            send('cancelled', { status: 'cancelled' });
            controller.close();
            return;
          }

          const [caseId, question, bucketStr] = key.split('__');
          const scoreBucket = Number(bucketStr);
          if (!caseId || (question !== 'q1' && question !== 'q2') || !Number.isFinite(scoreBucket)) continue;

          await rebuildTypicalExamplesForBucketServiceRole({
            caseId,
            question,
            scoreBucket,
            maxClusters: 3,
          });
          typicalDone += 1;

          if (typicalDone % 10 === 0) {
            send('prepare_progress', { phase: 'typicals', done: typicalDone, total: items.length });

            // DBにも進捗を保存
            await updateJob({ typicals_done: typicalDone });
          }
        }

        if (cancelled) {
          controller.close();
          return;
        }

        send('prepare_done', {
          status: 'done',
          embeddings: { processed: totalProcessed, succeeded: totalSucceeded, failed: totalFailed },
          typicals: { done: typicalDone, scheduled: items.length },
        });

        // DBに完了を保存
        await updateJob({
          status: 'completed',
          prepare_status: 'completed',
          typicals_done: typicalDone,
          completed_at: new Date().toISOString(),
        });

        controller.close();
      } catch (error) {
        console.error('upload route error:', error);
        const errorMsg = error instanceof Error ? error.message : 'アップロード処理中にエラーが発生しました';

        // SSEでエラーを送信
        if (sseConnected) {
          try {
            controller.enqueue(encoder.encode(sseEvent('error', { error: errorMsg })));
          } catch {
            // SSE送信失敗は無視
          }
        }

        // DBにエラーを保存（Service Role版）
        if (jobId) {
          try {
            await updateUploadJobServiceRole(jobId, {
              status: 'error',
              error_message: errorMsg,
            });
          } catch (dbErr) {
            console.error('Failed to update job status:', dbErr);
          }
        }

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

// バッチをDBに保存（Service Role版 - JWT期限切れの影響を受けない）
async function flushBatchServiceRole(batch: CsvRowData[], touchedBuckets: Set<string>) {
  const dbRecords = batch.map(({ case_name: _caseName, ...rest }) => {
    void _caseName;
    return rest;
  });

  await insertResponsesServiceRole(dbRecords);

  // エンベディングキュー投入
  await enqueueEmbeddingJobsServiceRole(
    batch.flatMap((r) => {
      const jobs: { case_id: string; response_id: string; question: 'q1' | 'q2' }[] = [];
      if (r.answer_q1 && r.answer_q1.trim()) {
        jobs.push({ case_id: r.case_id, response_id: r.response_id, question: 'q1' });
      }
      const hasQ2Content = [r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8]
        .some((a) => a && a.trim());
      if (hasQ2Content) {
        jobs.push({ case_id: r.case_id, response_id: r.response_id, question: 'q2' });
      }
      return jobs;
    })
  );

  // 典型例再計算用
  for (const r of batch) {
    if (typeof r.score_problem === 'number') {
      touchedBuckets.add(`${r.case_id}__q1__${toScoreBucket(r.score_problem)}`);
    }
    if (typeof r.score_solution === 'number') {
      touchedBuckets.add(`${r.case_id}__q2__${toScoreBucket(r.score_solution)}`);
    }
  }
}
