import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const { mockGetAuthedUserId, mockGetAnyAccessToken, mockCreateAuthedAnonServerClient } = vi.hoisted(() => ({
  mockGetAuthedUserId: vi.fn(),
  mockGetAnyAccessToken: vi.fn(),
  mockCreateAuthedAnonServerClient: vi.fn(),
}));

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  getAuthedUserId: mockGetAuthedUserId,
  getAnyAccessToken: mockGetAnyAccessToken,
}));

vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: mockCreateAuthedAnonServerClient,
}));

// トップレベルインポート
import {
  recordUserScores,
  listUserScoreRecords,
  getUserScoreRecordById,
} from '../userScore';

describe('userScore actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // recordUserScores
  // ========================================
  describe('recordUserScores', () => {
    it('認証がない場合は何もしない', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);
      mockGetAuthedUserId.mockResolvedValue(null);

      // エラーを投げずに正常終了すること
      await expect(recordUserScores({
        caseId: 'case-123',
        scores: { problem: 3.5, solution: 4.0, role: 3.0 },
      })).resolves.toBeUndefined();
    });

    it('userIdがない場合は何もしない', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');
      mockGetAuthedUserId.mockResolvedValue(null);

      await expect(recordUserScores({
        caseId: 'case-123',
        scores: { problem: 3.5, solution: 4.0, role: 3.0 },
      })).resolves.toBeUndefined();
    });

    it('正常にスコアを記録', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');
      mockGetAuthedUserId.mockResolvedValue('user-123');

      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          insert: insertMock,
        })),
      });

      await recordUserScores({
        caseId: 'case-123',
        scores: { problem: 3.5, solution: 4.0, role: 3.0 },
      });

      expect(insertMock).toHaveBeenCalledWith({
        user_id: 'user-123',
        case_id: 'case-123',
        score_problem: 3.5,
        score_solution: 4.0,
        score_role: 3.0,
      });
    });

    it('DBエラーが発生してもエラーを投げない（ログのみ）', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');
      mockGetAuthedUserId.mockResolvedValue('user-123');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        })),
      });

      // エラーを投げずに正常終了
      await expect(recordUserScores({
        caseId: 'case-123',
        scores: { problem: 3.5, solution: 4.0, role: 3.0 },
      })).resolves.toBeUndefined();

      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // listUserScoreRecords
  // ========================================
  describe('listUserScoreRecords', () => {
    it('認証がない場合は空配列を返す', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);

      const result = await listUserScoreRecords({ userId: 'user-123' });

      expect(result).toEqual([]);
    });

    it('正常にスコア履歴を取得', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const mockRecords = [
        {
          id: 'record-1',
          user_id: 'user-123',
          case_id: 'case-1',
          score_problem: 3.5,
          score_solution: 4.0,
          score_role: 3.0,
          created_at: '2024-01-01T00:00:00Z',
        },
        {
          id: 'record-2',
          user_id: 'user-123',
          case_id: 'case-2',
          score_problem: 4.0,
          score_solution: 4.5,
          score_role: 3.5,
          created_at: '2024-01-02T00:00:00Z',
        },
      ];

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: mockRecords, error: null }),
              })),
            })),
          })),
        })),
      });

      const result = await listUserScoreRecords({ userId: 'user-123' });

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('record-1');
    });

    it('limitを指定できる', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const limitMock = vi.fn().mockResolvedValue({ data: [], error: null });
      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: limitMock,
              })),
            })),
          })),
        })),
      });

      await listUserScoreRecords({ userId: 'user-123', limit: 10 });

      expect(limitMock).toHaveBeenCalledWith(10);
    });

    it('DBエラー時は空配列を返す', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
              })),
            })),
          })),
        })),
      });

      const result = await listUserScoreRecords({ userId: 'user-123' });

      expect(result).toEqual([]);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ========================================
  // getUserScoreRecordById
  // ========================================
  describe('getUserScoreRecordById', () => {
    it('認証がない場合はnullを返す', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);

      const result = await getUserScoreRecordById({ id: 'record-123' });

      expect(result).toBeNull();
    });

    it('正常にレコードを取得', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const mockRecord = {
        id: 'record-123',
        user_id: 'user-123',
        case_id: 'case-1',
        score_problem: 3.5,
        score_solution: 4.0,
        score_role: 3.0,
        created_at: '2024-01-01T00:00:00Z',
      };

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: mockRecord, error: null }),
            })),
          })),
        })),
      });

      const result = await getUserScoreRecordById({ id: 'record-123' });

      expect(result).toEqual(mockRecord);
    });

    it('レコードが見つからない場合はnullを返す', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            })),
          })),
        })),
      });

      const result = await getUserScoreRecordById({ id: 'nonexistent-id' });

      expect(result).toBeNull();
    });

    it('DBエラー時はnullを返す', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockCreateAuthedAnonServerClient.mockReturnValue({
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
            })),
          })),
        })),
      });

      const result = await getUserScoreRecordById({ id: 'record-123' });

      expect(result).toBeNull();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});
