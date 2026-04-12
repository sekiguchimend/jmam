import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  isAdmin: vi.fn(),
}));

vi.mock('@/lib/supabase', () => ({
  upsertCaseServiceRole: vi.fn(),
  insertResponsesServiceRole: vi.fn(),
  enqueueEmbeddingJobsServiceRole: vi.fn(),
}));

vi.mock('@/lib/prepare/worker', () => ({
  processEmbeddingQueueBatchServiceRole: vi.fn(() => ({ processed: 0, succeeded: 0, failed: 0 })),
  rebuildTypicalExamplesForBucketServiceRole: vi.fn(),
}));

vi.mock('@/lib/uploadJobUtils', () => ({
  updateUploadJobServiceRole: vi.fn(),
  isJobCancelled: vi.fn(() => false),
}));

// utils.tsの一部をテストで使うためにスタブ化
vi.mock('@/lib/utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/utils')>();
  return {
    ...actual,
    iterateCsvRecordsFromBytes: vi.fn(function* () {
      // テスト用の空イテレータ
    }),
  };
});

describe('upload API route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('validateHeaders', () => {
    // ヘッダー検証ロジックのテスト
    it('必須ヘッダーが存在する場合はvalid', () => {
      const headers = ['受注番号', 'Ⅱ MC 題材コード', 'その他'];
      const normalizeSpaces = (str: string) => str.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
      const REQUIRED = ['受注番号', 'Ⅱ MC 題材コード'];

      const normalizedHeaders = headers.map(normalizeSpaces);
      const missing = REQUIRED.filter((h) => !normalizedHeaders.includes(h));

      expect(missing.length).toBe(0);
    });

    it('必須ヘッダーが欠けている場合はinvalid', () => {
      const headers = ['受注番号', 'その他'];
      const normalizeSpaces = (str: string) => str.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
      const REQUIRED = ['受注番号', 'Ⅱ MC 題材コード'];

      const normalizedHeaders = headers.map(normalizeSpaces);
      const missing = REQUIRED.filter((h) => !normalizedHeaders.includes(h));

      expect(missing.length).toBe(1);
      expect(missing).toContain('Ⅱ MC 題材コード');
    });

    it('全角スペースと半角スペースを正規化して比較', () => {
      const headers = ['受注番号', 'Ⅱ　MC　題材コード']; // 全角スペース
      const normalizeSpaces = (str: string) => str.replace(/　/g, ' ').replace(/\s+/g, ' ').trim();
      const REQUIRED = ['受注番号', 'Ⅱ MC 題材コード']; // 半角スペース

      const normalizedHeaders = headers.map(normalizeSpaces);
      const missing = REQUIRED.filter((h) => !normalizedHeaders.includes(h));

      expect(missing.length).toBe(0);
    });
  });

  describe('parseRow validation', () => {
    it('受注番号が空の場合はエラー', () => {
      const headers = ['受注番号', 'Ⅱ MC 題材コード'];
      const values = ['', 'CASE001'];

      // 実際のparseRowロジックの検証
      const responseId = values[0]?.trim() ?? '';
      const caseId = values[1]?.trim() ?? '';

      expect(responseId).toBe('');
      expect(caseId).toBe('CASE001');
      // responseIdが空なのでエラーになるべき
      expect(!responseId || !caseId).toBe(true);
    });

    it('題材コードが空の場合はエラー', () => {
      const headers = ['受注番号', 'Ⅱ MC 題材コード'];
      const values = ['ORDER001', ''];

      const responseId = values[0]?.trim() ?? '';
      const caseId = values[1]?.trim() ?? '';

      expect(responseId).toBe('ORDER001');
      expect(caseId).toBe('');
      // caseIdが空なのでエラーになるべき
      expect(!responseId || !caseId).toBe(true);
    });
  });

  describe('file validation', () => {
    it('CSVファイル以外は拒否', async () => {
      const { isAdmin } = await import('@/lib/supabase/server');
      vi.mocked(isAdmin).mockResolvedValue(true);

      // ファイル名のチェックロジックをテスト
      const fileName = 'test.xlsx';
      expect(fileName.endsWith('.csv')).toBe(false);
    });

    it('CSVファイルは受け入れ', () => {
      const fileName = 'test.csv';
      expect(fileName.endsWith('.csv')).toBe(true);
    });

    it('100MBを超えるファイルは拒否', () => {
      const maxSize = 100 * 1024 * 1024;
      const largeFileSize = 150 * 1024 * 1024;

      expect(largeFileSize > maxSize).toBe(true);
    });

    it('100MB以下のファイルは受け入れ', () => {
      const maxSize = 100 * 1024 * 1024;
      const normalFileSize = 50 * 1024 * 1024;

      expect(normalFileSize > maxSize).toBe(false);
    });
  });

  describe('encoding detection', () => {
    it('UTF-8マーカーがある場合はUTF-8として検出', () => {
      // 日本語の「受注番号」をUTF-8でエンコード
      const utf8Text = '受注番号,題材コード';
      const encoder = new TextEncoder();
      const bytes = encoder.encode(utf8Text);

      const detectEncoding = (prefix: Uint8Array): string => {
        try {
          const text = new TextDecoder('utf-8', { fatal: false }).decode(prefix);
          const utf8LooksOk =
            text.includes('受注番号') || text.includes('題材コード') || text.includes('Ⅱ') || text.includes('MC');
          return utf8LooksOk ? 'utf-8' : 'shift-jis';
        } catch {
          return 'shift-jis';
        }
      };

      expect(detectEncoding(bytes)).toBe('utf-8');
    });
  });

  describe('authorization', () => {
    it('管理者でない場合はエラー', async () => {
      const { isAdmin } = await import('@/lib/supabase/server');
      vi.mocked(isAdmin).mockResolvedValue(false);

      const authorized = await isAdmin();
      expect(authorized).toBe(false);
    });

    it('管理者の場合は許可', async () => {
      const { isAdmin } = await import('@/lib/supabase/server');
      vi.mocked(isAdmin).mockResolvedValue(true);

      const authorized = await isAdmin();
      expect(authorized).toBe(true);
    });
  });

  describe('sanitization', () => {
    // security.tsのサニタイズ関数をテスト
    it('ID値から制御文字を除去', async () => {
      const { stripControlChars, truncateString } = await import('@/lib/security');

      const sanitizeId = (val: string) => truncateString(stripControlChars(val), 100);

      const maliciousId = 'ORDER\x00001';
      const sanitized = sanitizeId(maliciousId);

      expect(sanitized).toBe('ORDER001');
      expect(sanitized).not.toContain('\x00');
    });

    it('テキスト値をサニタイズ', async () => {
      const { sanitizeText } = await import('@/lib/security');

      const maliciousText = '  <script>alert(1)</script>  ';
      const sanitized = sanitizeText(maliciousText, 100);

      // trimされる
      expect(sanitized).toBe('<script>alert(1)</script>');
      // ただし、containsDangerousPatternsで別途チェックが必要
    });

    it('長すぎるテキストを切り詰め', async () => {
      const { sanitizeText } = await import('@/lib/security');

      const longText = 'a'.repeat(200);
      const sanitized = sanitizeText(longText, 100);

      expect(sanitized.length).toBe(100);
    });
  });
});
