import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockIsAdmin,
  mockGetAccessToken,
  mockGetDatasetStats,
  mockDeleteResponsesByCaseId,
  mockGetTotalResponseCount,
  mockEnqueueEmbeddingJobs,
  mockUpsertCase,
  mockInsertResponses,
} = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockGetDatasetStats: vi.fn(),
  mockDeleteResponsesByCaseId: vi.fn(),
  mockGetTotalResponseCount: vi.fn(),
  mockEnqueueEmbeddingJobs: vi.fn(),
  mockUpsertCase: vi.fn(),
  mockInsertResponses: vi.fn(),
}));

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  isAdmin: mockIsAdmin,
  getAccessToken: mockGetAccessToken,
}));

vi.mock('@/lib/supabase', () => ({
  getDatasetStats: mockGetDatasetStats,
  deleteResponsesByCaseId: mockDeleteResponsesByCaseId,
  getTotalResponseCount: mockGetTotalResponseCount,
  enqueueEmbeddingJobs: mockEnqueueEmbeddingJobs,
  upsertCase: mockUpsertCase,
  insertResponses: mockInsertResponses,
}));

vi.mock('@/lib/scoring', () => ({
  toScoreBucket: vi.fn((score: number) => Math.round(score * 2) / 2),
}));

vi.mock('@/lib/prepare/worker', () => ({
  processEmbeddingQueueBatchWithToken: vi.fn(),
  rebuildTypicalExamplesForBucketWithToken: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
  sanitizeText: vi.fn((s: string) => s.replace(/[<>]/g, '')),
  stripControlChars: vi.fn((s: string) => s.replace(/[\x00-\x1F\x7F]/g, '')),
  truncateString: vi.fn((s: string, len: number) => s.slice(0, len)),
}));

// トップレベルインポート
import {
  fetchDatasetStats,
  fetchTotalCount,
  deleteDatasetByCaseId,
  createNewCase,
  processCsvUpload,
} from '../upload';

describe('upload actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // fetchDatasetStats
  // ========================================
  describe('fetchDatasetStats', () => {
    it('管理者でない場合は空配列を返す', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await fetchDatasetStats();

      expect(result).toEqual([]);
    });

    it('正常にデータセット統計を取得', async () => {
      mockIsAdmin.mockResolvedValue(true);
      const mockStats = [
        { case_id: 'case-1', case_name: 'ケース1', count: 100 },
        { case_id: 'case-2', case_name: 'ケース2', count: 200 },
      ];
      mockGetDatasetStats.mockResolvedValue(mockStats);

      const result = await fetchDatasetStats();

      expect(result).toEqual(mockStats);
    });

    it('エラー時は空配列を返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetDatasetStats.mockRejectedValue(new Error('DB error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchDatasetStats();

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // fetchTotalCount
  // ========================================
  describe('fetchTotalCount', () => {
    it('管理者でない場合は0を返す', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await fetchTotalCount();

      expect(result).toBe(0);
    });

    it('正常に合計数を取得', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetTotalResponseCount.mockResolvedValue(500);

      const result = await fetchTotalCount();

      expect(result).toBe(500);
    });

    it('エラー時は0を返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetTotalResponseCount.mockRejectedValue(new Error('DB error'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await fetchTotalCount();

      expect(result).toBe(0);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // deleteDatasetByCaseId
  // ========================================
  describe('deleteDatasetByCaseId', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await deleteDatasetByCaseId('case-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('正常にデータセットを削除', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockDeleteResponsesByCaseId.mockResolvedValue(50);

      const result = await deleteDatasetByCaseId('case-123');

      expect(result.success).toBe(true);
      expect(result.deletedCount).toBe(50);
    });

    it('エラー時はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockDeleteResponsesByCaseId.mockRejectedValue(new Error('削除エラー'));

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await deleteDatasetByCaseId('case-123');

      expect(result.success).toBe(false);
      // セキュリティ: 内部エラー詳細は隠蔽され、汎用メッセージが返される
      expect(result.error).toBe('データの削除に失敗しました');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // createNewCase
  // ========================================
  describe('createNewCase', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await createNewCase({
        caseId: 'case-123',
        caseName: 'テストケース',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      const result = await createNewCase({
        caseId: 'case-123',
        caseName: 'テストケース',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('認証トークン');
    });

    it('caseIdが空の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const result = await createNewCase({
        caseId: '',
        caseName: 'テストケース',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ケースIDを入力');
    });

    it('caseIdが100文字超の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const result = await createNewCase({
        caseId: 'a'.repeat(101),
        caseName: 'テストケース',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('100文字以内');
    });

    it('caseNameが255文字超の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const result = await createNewCase({
        caseId: 'case-123',
        caseName: 'a'.repeat(256),
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('255文字以内');
    });

    it('正常にケースを作成', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockUpsertCase.mockResolvedValue(undefined);

      const result = await createNewCase({
        caseId: 'case-123',
        caseName: 'テストケース',
      });

      expect(result.success).toBe(true);
      expect(mockUpsertCase).toHaveBeenCalledWith(
        { case_id: 'case-123', case_name: 'テストケース' },
        'valid-token'
      );
    });

    it('caseNameが空の場合はnullで保存', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockUpsertCase.mockResolvedValue(undefined);

      await createNewCase({
        caseId: 'case-123',
        caseName: '',
      });

      expect(mockUpsertCase).toHaveBeenCalledWith(
        { case_id: 'case-123', case_name: null },
        'valid-token'
      );
    });
  });

  // ========================================
  // processCsvUpload
  // ========================================
  describe('processCsvUpload', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const formData = new FormData();
      const result = await processCsvUpload(formData);

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      const formData = new FormData();
      const result = await processCsvUpload(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('認証トークン');
    });

    it('ファイルがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const formData = new FormData();
      const result = await processCsvUpload(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('ファイルが選択');
    });

    it('CSV以外のファイルはエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const formData = new FormData();
      const file = new File(['content'], 'test.txt', { type: 'text/plain' });
      formData.append('file', file);

      const result = await processCsvUpload(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('CSVファイルのみ');
    });

    it('ファイルサイズが100MB超はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const formData = new FormData();

      // 100MB超のモックファイルを作成
      const largeContent = 'a'.repeat(101 * 1024 * 1024);
      const file = new File([largeContent], 'test.csv', { type: 'text/csv' });
      formData.append('file', file);

      const result = await processCsvUpload(formData);

      expect(result.success).toBe(false);
      expect(result.error).toContain('100MB');
    });
  });
});
