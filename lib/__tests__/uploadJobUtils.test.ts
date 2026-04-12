import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

// server-onlyモック
vi.mock('server-only', () => ({}));

vi.mock('@/lib/uploadJobTypes', () => ({
  CANCELLED_MESSAGE: 'キャンセルされました',
}));

// supabaseServiceRoleのモック状態
const mockFrom = vi.fn();

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseServiceRole: {
    from: mockFrom,
  },
}));

// テスト対象モジュールをトップレベルでインポート
import { updateUploadJobServiceRole, isJobCancelled } from '../uploadJobUtils';

describe('uploadJobUtils', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // updateUploadJobServiceRole
  // ========================================
  describe('updateUploadJobServiceRole', () => {
    it('正常にジョブを更新', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      await updateUploadJobServiceRole('job-123', {
        status: 'processing',
        processed_rows: 100,
      });

      expect(mockFrom).toHaveBeenCalledWith('upload_jobs');
      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'processing',
        processed_rows: 100,
      });
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 'job-123');
    });

    it('エンベディング進捗を更新', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      await updateUploadJobServiceRole('job-123', {
        prepare_status: 'embedding',
        embedding_processed: 50,
        embedding_succeeded: 48,
        embedding_failed: 2,
      });

      expect(mockQuery.update).toHaveBeenCalledWith({
        prepare_status: 'embedding',
        embedding_processed: 50,
        embedding_succeeded: 48,
        embedding_failed: 2,
      });
    });

    it('典型例進捗を更新', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      await updateUploadJobServiceRole('job-123', {
        prepare_status: 'typical',
        typicals_done: 10,
        typicals_total: 20,
      });

      expect(mockQuery.update).toHaveBeenCalledWith({
        prepare_status: 'typical',
        typicals_done: 10,
        typicals_total: 20,
      });
    });

    it('完了状態に更新', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      await updateUploadJobServiceRole('job-123', {
        status: 'completed',
        completed_at: '2024-01-01T00:00:00Z',
      });

      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'completed',
        completed_at: '2024-01-01T00:00:00Z',
      });
    });

    it('エラー時は例外をスロー', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      await expect(
        updateUploadJobServiceRole('job-123', { status: 'processing' })
      ).rejects.toThrow('ジョブの更新に失敗しました');

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('エラー状態とエラーメッセージを更新', async () => {
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      await updateUploadJobServiceRole('job-123', {
        status: 'error',
        error_message: '処理中にエラーが発生しました',
        errors: ['エラー1', 'エラー2'],
      });

      expect(mockQuery.update).toHaveBeenCalledWith({
        status: 'error',
        error_message: '処理中にエラーが発生しました',
        errors: ['エラー1', 'エラー2'],
      });
    });
  });

  // ========================================
  // isJobCancelled
  // ========================================
  describe('isJobCancelled', () => {
    it('キャンセルされたジョブの場合はtrueを返す', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { status: 'error', error_message: 'キャンセルされました' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      const result = await isJobCancelled('job-123');

      expect(result).toBe(true);
    });

    it('キャンセルされていないジョブの場合はfalseを返す', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { status: 'processing', error_message: null },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      const result = await isJobCancelled('job-123');

      expect(result).toBe(false);
    });

    it('エラー状態だがキャンセル以外の場合はfalseを返す', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { status: 'error', error_message: '別のエラー' },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      const result = await isJobCancelled('job-123');

      expect(result).toBe(false);
    });

    it('ジョブが見つからない場合はfalseを返す', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      const result = await isJobCancelled('job-123');

      expect(result).toBe(false);
    });

    it('例外発生時はfalseを返す', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error('DB error')),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      const result = await isJobCancelled('job-123');

      expect(result).toBe(false);
    });

    it('完了状態の場合はfalseを返す', async () => {
      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { status: 'completed', error_message: null },
          error: null,
        }),
      };
      mockFrom.mockReturnValue(mockQuery as any);

      const result = await isJobCancelled('job-123');

      expect(result).toBe(false);
    });
  });
});
