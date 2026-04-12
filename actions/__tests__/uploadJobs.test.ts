import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const { mockIsAdmin, mockGetAuthedUserId, mockFrom } = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockGetAuthedUserId: vi.fn(),
  mockFrom: vi.fn(),
}));

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  isAdmin: mockIsAdmin,
  getAuthedUserId: mockGetAuthedUserId,
}));

vi.mock('@/lib/supabase/service-role', () => ({
  supabaseServiceRole: {
    from: mockFrom,
  },
}));

vi.mock('@/lib/uploadJobTypes', () => ({
  CANCELLED_MESSAGE: 'キャンセルされました',
  DISMISSED_MARKER: '__DISMISSED__',
}));

// トップレベルインポート
import {
  getActiveUploadJob,
  createUploadJob,
  cancelUploadJob,
  dismissUploadJob,
} from '../uploadJobs';

describe('uploadJobs actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // getActiveUploadJob
  // ========================================
  describe('getActiveUploadJob', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await getActiveUploadJob();

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('アクティブなジョブがある場合はジョブを返す', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const mockJob = {
        id: 'job-123',
        file_name: 'test.csv',
        status: 'processing',
        progress_percent: 50,
      };

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ error: null }),
        single: vi.fn().mockResolvedValue({ data: mockJob, error: null }),
      };

      mockFrom.mockReturnValue(mockQuery as any);

      const result = await getActiveUploadJob();

      expect(result.success).toBe(true);
      expect(result.job).toBeDefined();
    });

    it('ジョブが見つからない場合はundefined', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        or: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ error: null }),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
      };

      mockFrom.mockReturnValue(mockQuery as any);

      const result = await getActiveUploadJob();

      expect(result.success).toBe(true);
      expect(result.job).toBeUndefined();
    });
  });

  // ========================================
  // createUploadJob
  // ========================================
  describe('createUploadJob', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await createUploadJob({
        fileName: 'test.csv',
        fileSize: 1024,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('ユーザーIDがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAuthedUserId.mockResolvedValue(null);

      const result = await createUploadJob({
        fileName: 'test.csv',
        fileSize: 1024,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ユーザーID');
    });

    it('実行中のジョブがある場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAuthedUserId.mockResolvedValue('user-123');

      const existingJob = {
        id: 'existing-job',
        file_name: 'other.csv',
        created_at: new Date().toISOString(),
      };

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ error: null }),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: existingJob, error: null }),
      };

      mockFrom.mockReturnValue(mockQuery as any);

      const result = await createUploadJob({
        fileName: 'test.csv',
        fileSize: 1024,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('別のアップロード');
    });

    it('正常にジョブを作成', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAuthedUserId.mockResolvedValue('user-123');

      let callCount = 0;
      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        lt: vi.fn().mockResolvedValue({ error: null }),
        limit: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // existingJobチェック - 見つからない
            return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
          }
          // insert後のselect
          return Promise.resolve({ data: { id: 'new-job-123' }, error: null });
        }),
      };

      mockFrom.mockReturnValue(mockQuery as any);

      const result = await createUploadJob({
        fileName: 'test.csv',
        fileSize: 1024,
      });

      expect(result.success).toBe(true);
      expect(result.jobId).toBe('new-job-123');
    });
  });

  // ========================================
  // cancelUploadJob
  // ========================================
  describe('cancelUploadJob', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await cancelUploadJob('job-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('正常にジョブをキャンセル', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ error: null }),
      };

      mockFrom.mockReturnValue(mockQuery as any);

      const result = await cancelUploadJob('job-123');

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: 'キャンセルされました',
        })
      );
    });
  });

  // ========================================
  // dismissUploadJob
  // ========================================
  describe('dismissUploadJob', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await dismissUploadJob('job-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('正常にジョブをクリア', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const mockQuery = {
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };

      mockFrom.mockReturnValue(mockQuery as any);

      const result = await dismissUploadJob('job-123');

      expect(result.success).toBe(true);
      expect(mockQuery.update).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'error',
          error_message: '__DISMISSED__',
        })
      );
    });
  });
});
