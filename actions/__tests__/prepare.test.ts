import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockIsAdmin,
  mockGetAccessToken,
  mockProcessEmbeddingQueueBatchWithToken,
  mockRebuildTypicalExamplesForBucketWithToken,
  mockCreateAuthedAnonServerClient,
} = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockProcessEmbeddingQueueBatchWithToken: vi.fn(),
  mockRebuildTypicalExamplesForBucketWithToken: vi.fn(),
  mockCreateAuthedAnonServerClient: vi.fn(),
}));

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  isAdmin: mockIsAdmin,
  getAccessToken: mockGetAccessToken,
}));

vi.mock('@/lib/prepare/worker', () => ({
  processEmbeddingQueueBatchWithToken: mockProcessEmbeddingQueueBatchWithToken,
  rebuildTypicalExamplesForBucketWithToken: mockRebuildTypicalExamplesForBucketWithToken,
}));

vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: mockCreateAuthedAnonServerClient,
}));

// トップレベルインポート
import {
  processEmbeddingQueueBatch,
  rebuildTypicalExamplesForBucket,
  updateScoreDistribution,
  updateAllScoreDistributions,
} from '../prepare';

describe('prepare actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // processEmbeddingQueueBatch
  // ========================================
  describe('processEmbeddingQueueBatch', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      await expect(processEmbeddingQueueBatch()).rejects.toThrow('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      await expect(processEmbeddingQueueBatch()).rejects.toThrow('管理者トークン');
    });

    it('正常にエンベディングキューを処理', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockProcessEmbeddingQueueBatchWithToken.mockResolvedValue({
        processed: 50,
        succeeded: 48,
        failed: 2,
      });

      const result = await processEmbeddingQueueBatch(50);

      expect(result.processed).toBe(50);
      expect(result.succeeded).toBe(48);
      expect(result.failed).toBe(2);
      expect(mockProcessEmbeddingQueueBatchWithToken).toHaveBeenCalledWith('valid-token', 50);
    });

    it('デフォルトlimitは50', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockProcessEmbeddingQueueBatchWithToken.mockResolvedValue({
        processed: 0,
        succeeded: 0,
        failed: 0,
      });

      await processEmbeddingQueueBatch();

      expect(mockProcessEmbeddingQueueBatchWithToken).toHaveBeenCalledWith('valid-token', 50);
    });
  });

  // ========================================
  // rebuildTypicalExamplesForBucket
  // ========================================
  describe('rebuildTypicalExamplesForBucket', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      await expect(
        rebuildTypicalExamplesForBucket({
          caseId: 'case-123',
          question: 'q1',
          scoreBucket: 3.5,
        })
      ).rejects.toThrow('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      await expect(
        rebuildTypicalExamplesForBucket({
          caseId: 'case-123',
          question: 'q1',
          scoreBucket: 3.5,
        })
      ).rejects.toThrow('管理者トークン');
    });

    it('正常に典型例を再構築', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockRebuildTypicalExamplesForBucketWithToken.mockResolvedValue({
        clusters: 3,
        points: 15,
      });

      const result = await rebuildTypicalExamplesForBucket({
        caseId: 'case-123',
        question: 'q1',
        scoreBucket: 3.5,
        maxClusters: 5,
      });

      expect(result.clusters).toBe(3);
      expect(result.points).toBe(15);
      expect(mockRebuildTypicalExamplesForBucketWithToken).toHaveBeenCalledWith({
        adminToken: 'valid-token',
        caseId: 'case-123',
        question: 'q1',
        scoreBucket: 3.5,
        maxClusters: 5,
      });
    });
  });

  // ========================================
  // updateScoreDistribution
  // ========================================
  describe('updateScoreDistribution', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await updateScoreDistribution({
        caseId: 'case-123',
        question: 'q1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      const result = await updateScoreDistribution({
        caseId: 'case-123',
        question: 'q1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('管理者トークン');
    });

    it('正常にスコア分布を更新', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateAuthedAnonServerClient.mockReturnValue({
        rpc: rpcMock,
      });

      const result = await updateScoreDistribution({
        caseId: 'case-123',
        question: 'q1',
      });

      expect(result.success).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith('update_score_distribution', {
        p_case_id: 'case-123',
        p_question: 'q1',
      });
    });

    it('RPC呼び出しエラー時はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateAuthedAnonServerClient.mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ error: { message: 'RPC error' } }),
      });

      const result = await updateScoreDistribution({
        caseId: 'case-123',
        question: 'q1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // updateAllScoreDistributions
  // ========================================
  describe('updateAllScoreDistributions', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await updateAllScoreDistributions();

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      const result = await updateAllScoreDistributions();

      expect(result.success).toBe(false);
      expect(result.error).toContain('管理者トークン');
    });

    it('正常に全スコア分布を更新', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const rpcMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateAuthedAnonServerClient.mockReturnValue({
        rpc: rpcMock,
      });

      const result = await updateAllScoreDistributions();

      expect(result.success).toBe(true);
      expect(rpcMock).toHaveBeenCalledWith('update_all_score_distributions');
    });

    it('RPC呼び出しエラー時はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateAuthedAnonServerClient.mockReturnValue({
        rpc: vi.fn().mockResolvedValue({ error: { message: 'RPC error' } }),
      });

      const result = await updateAllScoreDistributions();

      expect(result.success).toBe(false);
      expect(result.error).toBe('RPC error');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it('例外発生時はエラーを返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateAuthedAnonServerClient.mockReturnValue({
        rpc: vi.fn().mockRejectedValue(new Error('Unexpected error')),
      });

      const result = await updateAllScoreDistributions();

      expect(result.success).toBe(false);
      // セキュリティ: 内部エラー詳細は隠蔽され、汎用メッセージが返される
      expect(result.error).toBe('エラーが発生しました');
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
