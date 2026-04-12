import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  getAnyAccessToken: vi.fn(),
  getAuthedUserId: vi.fn(),
  hasAccessToken: vi.fn(),
  getAccessToken: vi.fn(),
}));

vi.mock('@/lib/supabase/authed-anon-server', () => ({
  createAuthedAnonServerClient: vi.fn(),
}));

// Supabaseクエリビルダーのモック
function createMockQueryBuilder(mockData: any = [], mockError: any = null, mockCount: number = 0) {
  const builder: any = {
    insert: vi.fn(() => builder),
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    in: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn(() => builder),
    single: vi.fn(() => Promise.resolve({ data: mockData, error: mockError })),
    then: (resolve: any) => resolve({ data: mockData, count: mockCount, error: mockError }),
  };
  return builder;
}

describe('predictionHistory actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  // ========================================
  // savePredictionHistoryExisting
  // ========================================
  describe('savePredictionHistoryExisting', () => {
    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);
      vi.mocked(getAuthedUserId).mockResolvedValue(null);

      const { savePredictionHistoryExisting } = await import('../predictionHistory');
      const result = await savePredictionHistoryExisting({
        caseId: 'case-123',
        caseName: 'テストケース',
        q1Answer: '解答1',
        q2Answer: '解答2',
        resultScores: { problem: 3.0, solution: 3.5 } as any,
        explanation: '説明',
        confidence: 0.8,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常に履歴を保存', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      } as any);

      const { savePredictionHistoryExisting } = await import('../predictionHistory');
      const result = await savePredictionHistoryExisting({
        caseId: 'case-123',
        caseName: 'テストケース',
        q1Answer: '解答1',
        q2Answer: '解答2',
        resultScores: { problem: 3.0, solution: 3.5 } as any,
        explanation: '説明',
        confidence: 0.8,
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-123',
          prediction_type: 'score_existing',
          case_id: 'case-123',
        })
      );
    });

    it('DB保存エラー時はエラーを返す', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({ error: { message: 'DB error' } }),
        }),
      } as any);

      const { savePredictionHistoryExisting } = await import('../predictionHistory');
      const result = await savePredictionHistoryExisting({
        caseId: 'case-123',
        caseName: 'テストケース',
        q1Answer: '解答1',
        q2Answer: '解答2',
        resultScores: { problem: 3.0, solution: 3.5 } as any,
        explanation: '説明',
        confidence: 0.8,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('履歴の保存に失敗');
    });
  });

  // ========================================
  // savePredictionHistoryNew
  // ========================================
  describe('savePredictionHistoryNew', () => {
    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);
      vi.mocked(getAuthedUserId).mockResolvedValue(null);

      const { savePredictionHistoryNew } = await import('../predictionHistory');
      const result = await savePredictionHistoryNew({
        situationText: 'シチュエーション',
        q1Answer: '解答1',
        q2Answer: '解答2',
        resultScores: { problem: 3.0, solution: 3.5 } as any,
        explanation: '説明',
        confidence: 0.7,
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常に新規ケース履歴を保存', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      } as any);

      const { savePredictionHistoryNew } = await import('../predictionHistory');
      const result = await savePredictionHistoryNew({
        situationText: 'シチュエーション',
        q1Answer: '解答1',
        q2Answer: '解答2',
        resultScores: { problem: 3.0, solution: 3.5 } as any,
        explanation: '説明',
        confidence: 0.7,
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          prediction_type: 'score_new',
          situation_text: 'シチュエーション',
        })
      );
    });
  });

  // ========================================
  // savePredictionHistoryAnswer
  // ========================================
  describe('savePredictionHistoryAnswer', () => {
    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);
      vi.mocked(getAuthedUserId).mockResolvedValue(null);

      const { savePredictionHistoryAnswer } = await import('../predictionHistory');
      const result = await savePredictionHistoryAnswer({
        caseId: 'case-123',
        caseName: 'テストケース',
        inputScores: { problem: 3.0 } as any,
        resultQ1: '予測解答1',
        resultQ2: '予測解答2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常に解答予測履歴を保存', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockInsert = vi.fn().mockResolvedValue({ error: null });
      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue({
          insert: mockInsert,
        }),
      } as any);

      const { savePredictionHistoryAnswer } = await import('../predictionHistory');
      const result = await savePredictionHistoryAnswer({
        caseId: 'case-123',
        caseName: 'テストケース',
        inputScores: { problem: 3.0 } as any,
        resultQ1: '予測解答1',
        resultQ2: '予測解答2',
      });

      expect(result.success).toBe(true);
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          prediction_type: 'answer',
          result_predicted_q1: '予測解答1',
          result_predicted_q2: '予測解答2',
        })
      );
    });
  });

  // ========================================
  // fetchPredictionHistory
  // ========================================
  describe('fetchPredictionHistory', () => {
    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);
      vi.mocked(getAuthedUserId).mockResolvedValue(null);

      const { fetchPredictionHistory } = await import('../predictionHistory');
      const result = await fetchPredictionHistory();

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常に履歴を取得', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockRecords = [
        { id: '1', prediction_type: 'score_existing', case_id: 'case-1' },
        { id: '2', prediction_type: 'score_new', situation_text: 'シチュエーション' },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockRecords, count: 2, error: null }),
      };

      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery),
      } as any);

      const { fetchPredictionHistory } = await import('../predictionHistory');
      const result = await fetchPredictionHistory();

      expect(result.success).toBe(true);
      expect(result.records).toHaveLength(2);
      expect(result.total).toBe(2);
    });

    it('タイプでフィルタ可能', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], count: 0, error: null }),
      };

      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery),
      } as any);

      const { fetchPredictionHistory } = await import('../predictionHistory');

      // score_allタイプでフィルタ
      await fetchPredictionHistory({ type: 'score_all' });
      expect(mockQuery.in).toHaveBeenCalledWith('prediction_type', ['score_existing', 'score_new']);
    });

    it('ページネーション可能', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], count: 100, error: null }),
      };

      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery),
      } as any);

      const { fetchPredictionHistory } = await import('../predictionHistory');
      await fetchPredictionHistory({ limit: 10, offset: 20 });

      expect(mockQuery.range).toHaveBeenCalledWith(20, 29);
    });
  });

  // ========================================
  // fetchPredictionHistoryById
  // ========================================
  describe('fetchPredictionHistoryById', () => {
    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);
      vi.mocked(getAuthedUserId).mockResolvedValue(null);

      const { fetchPredictionHistoryById } = await import('../predictionHistory');
      const result = await fetchPredictionHistoryById('history-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常に履歴詳細を取得', async () => {
      const { getAnyAccessToken, getAuthedUserId } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(getAuthedUserId).mockResolvedValue('user-123');

      const mockRecord = {
        id: 'history-123',
        prediction_type: 'score_existing',
        case_id: 'case-1',
        result_scores: { problem: 3.0 },
      };

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockRecord, error: null }),
      };

      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn().mockReturnValue(mockQuery),
      } as any);

      const { fetchPredictionHistoryById } = await import('../predictionHistory');
      const result = await fetchPredictionHistoryById('history-123');

      expect(result.success).toBe(true);
      expect(result.record).toEqual(mockRecord);
    });
  });

  // ========================================
  // adminFetchPredictionHistory
  // ========================================
  describe('adminFetchPredictionHistory', () => {
    it('管理者権限がない場合はエラー', async () => {
      const { hasAccessToken, getAccessToken } = await import('@/lib/supabase/server');
      vi.mocked(hasAccessToken).mockResolvedValue(false);

      const { adminFetchPredictionHistory } = await import('../predictionHistory');
      const result = await adminFetchPredictionHistory();

      expect(result.success).toBe(false);
      expect(result.error).toContain('管理者権限が必要');
    });

    it('正常に全ユーザー履歴を取得', async () => {
      const { hasAccessToken, getAccessToken } = await import('@/lib/supabase/server');
      const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');

      vi.mocked(hasAccessToken).mockResolvedValue(true);
      vi.mocked(getAccessToken).mockResolvedValue('admin-token');

      const mockRecords = [
        { id: '1', user_id: 'user-1', prediction_type: 'score_existing' },
        { id: '2', user_id: 'user-2', prediction_type: 'score_new' },
      ];

      const mockProfiles = [
        { id: 'user-1', email: 'user1@example.com', name: 'ユーザー1' },
        { id: 'user-2', email: 'user2@example.com', name: 'ユーザー2' },
      ];

      const mockHistoryQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: mockRecords, count: 2, error: null }),
      };

      const mockProfilesQuery = {
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockProfiles, error: null }),
      };

      vi.mocked(createAuthedAnonServerClient).mockReturnValue({
        from: vi.fn((table: string) => {
          if (table === 'prediction_history') return mockHistoryQuery;
          if (table === 'profiles') return mockProfilesQuery;
          return mockHistoryQuery;
        }),
      } as any);

      const { adminFetchPredictionHistory } = await import('../predictionHistory');
      const result = await adminFetchPredictionHistory();

      expect(result.success).toBe(true);
      expect(result.records).toHaveLength(2);
      expect(result.records![0].user_email).toBe('user1@example.com');
      expect(result.records![1].user_name).toBe('ユーザー2');
    });
  });
});
