// CSVアップロードのServer Actions
// FR-07〜FR-11: CSVアップロード、検証、バッチ処理
// Storage不要・直接処理版

'use server';

import {
  getDatasetStats,
  deleteResponsesByCaseId,
  getTotalResponseCount,
  enqueueEmbeddingJobs,
  upsertCase,
  insertResponses,
} from '@/lib/supabase';
import type { DatasetStats, CsvRowData } from '@/types';
import { isAdmin, getAccessToken } from '@/lib/supabase/server';
import { iterateCsvRecordsFromBytes, parseCSVLine, parseDate, parseScore } from '@/lib/utils';
import { toScoreBucket } from '@/lib/scoring';
import { processEmbeddingQueueBatchWithToken, rebuildTypicalExamplesForBucketWithToken } from '@/lib/prepare/worker';
import { sanitizeText, stripControlChars, truncateString } from '@/lib/security';

// ============================================
// 定数・ユーティリティ
// ============================================

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

// ============================================
// CSV直接処理（Storage不要）
// ============================================

export type UploadResult = {
  success: boolean;
  processed?: number;
  embeddings?: { processed: number; succeeded: number; failed: number };
  typicals?: { done: number; total: number };
  errors?: string[];
  error?: string;
};

export async function processCsvUpload(formData: FormData): Promise<UploadResult> {
  console.log('[processCsvUpload] 開始');

  try {
    // 管理者チェック
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    const token = await getAccessToken();
    if (!token) {
      return { success: false, error: '認証トークンが見つかりません（再ログインしてください）' };
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return { success: false, error: 'ファイルが選択されていません' };
    }

    if (!file.name.endsWith('.csv')) {
      return { success: false, error: 'CSVファイルのみアップロード可能です' };
    }

    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'ファイルサイズが100MBを超えています' };
    }

    console.log('[processCsvUpload] ファイル:', file.name, file.size, 'bytes');

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
    console.log('[processCsvUpload] エンコーディング:', encoding);

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

        return {
          success: false,
          error: `必須カラムが見つかりません: ${headerValidation.missing.join(', ')}`,
        };
      }

      const values = parseCSVLine(record);
      const result = parseRow(headers, values, recordNo);

      if (result.error) {
        errors.push(result.error);
        if (errors.length >= 10) {
          return {
            success: false,
            error: '検証エラーが多数あります。最初の10件を表示します。',
            errors,
          };
        }
        continue;
      }

      if (!result.data) continue;

      // ケースをupsert
      const caseId = result.data.case_id;
      if (!caseSeen.has(caseId)) {
        caseSeen.add(caseId);
        await upsertCase({
          case_id: caseId,
          case_name: result.data.case_name ?? null,
        }, token);
      }

      batch.push(result.data);

      if (batch.length >= BATCH_SIZE) {
        await flushBatch(batch, token, touchedBuckets);
        processedCount += batch.length;
        batch = [];
        console.log('[processCsvUpload] バッチ処理完了:', processedCount, '件');
      }
    }

    if (!headers) {
      return { success: false, error: 'データが存在しません' };
    }

    // 残りをフラッシュ
    if (batch.length > 0) {
      await flushBatch(batch, token, touchedBuckets);
      processedCount += batch.length;
    }

    console.log('[processCsvUpload] CSV解析完了:', processedCount, '件');

    // エンベディング処理
    let totalProcessed = 0;
    let totalSucceeded = 0;
    let totalFailed = 0;

    console.log('[processCsvUpload] エンベディング処理開始');
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const res = await processEmbeddingQueueBatchWithToken(token, 50);
      if (res.processed === 0) break;
      totalProcessed += res.processed;
      totalSucceeded += res.succeeded;
      totalFailed += res.failed;
      console.log('[processCsvUpload] エンベディング進捗:', totalProcessed, '/', totalSucceeded, '/', totalFailed);
    }

    // 典型例再計算
    const items = Array.from(touchedBuckets.values()).slice(0, 200);
    let typicalDone = 0;

    console.log('[processCsvUpload] 典型例再計算開始:', items.length, '件');
    for (const key of items) {
      const [caseId, question, bucketStr] = key.split('__');
      const scoreBucket = Number(bucketStr);
      if (!caseId || (question !== 'q1' && question !== 'q2') || !Number.isFinite(scoreBucket)) continue;

      await rebuildTypicalExamplesForBucketWithToken({
        adminToken: token,
        caseId,
        question,
        scoreBucket,
        maxClusters: 3,
      });
      typicalDone += 1;
    }

    console.log('[processCsvUpload] 完了');

    return {
      success: true,
      processed: processedCount,
      embeddings: { processed: totalProcessed, succeeded: totalSucceeded, failed: totalFailed },
      typicals: { done: typicalDone, total: items.length },
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch (error) {
    console.error('[processCsvUpload] 例外:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'アップロード処理に失敗しました',
    };
  }
}

// バッチをDBに保存
async function flushBatch(batch: CsvRowData[], token: string, touchedBuckets: Set<string>) {
  const dbRecords = batch.map(({ case_name: _caseName, ...rest }) => {
    void _caseName;
    return rest;
  });

  await insertResponses(dbRecords, token);

  // エンベディングキュー投入
  await enqueueEmbeddingJobs(
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
    }),
    token
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

// ============================================
// その他のアクション
// ============================================

export async function fetchDatasetStats(): Promise<DatasetStats[]> {
  try {
    if (!(await isAdmin())) return [];
    return await getDatasetStats();
  } catch (error) {
    console.error('fetchDatasetStats error:', error);
    return [];
  }
}

export async function fetchTotalCount(): Promise<number> {
  try {
    if (!(await isAdmin())) return 0;
    return await getTotalResponseCount();
  } catch (error) {
    console.error('fetchTotalCount error:', error);
    return 0;
  }
}

export async function deleteDatasetByCaseId(caseId: string): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }
    const deletedCount = await deleteResponsesByCaseId(caseId);
    return { success: true, deletedCount };
  } catch (error) {
    console.error('deleteDatasetByCaseId error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'データの削除に失敗しました'
    };
  }
}
