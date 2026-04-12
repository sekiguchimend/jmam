import { describe, it, expect, vi, beforeEach } from 'vitest';

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  getAnyAccessToken: vi.fn(),
}));

vi.mock('@/lib/supabase/anon-server', () => ({
  supabaseAnonServer: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/scoring', () => ({
  predictScoreFromAnswer: vi.fn(),
}));

vi.mock('@/lib/security', () => ({
  stripControlChars: vi.fn((s: string) => s.replace(/[\x00-\x1F\x7F]/g, '')),
  truncateString: vi.fn((s: string, len: number) => s.slice(0, len)),
}));

describe('predictScore actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // fetchCasesForScorePrediction
  // ========================================
  describe('fetchCasesForScorePrediction', () => {
    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);

      const { fetchCasesForScorePrediction } = await import('../predictScore');
      const result = await fetchCasesForScorePrediction();

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常にケース一覧を取得', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      const { supabaseAnonServer } = await import('@/lib/supabase/anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');

      const mockCases = [
        { case_id: 'case-1', case_name: 'ケース1', situation_text: '状況1' },
        { case_id: 'case-2', case_name: 'ケース2', situation_text: '状況2' },
      ];

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockCases, error: null }),
      };
      vi.mocked(supabaseAnonServer.from).mockReturnValue(mockQuery as any);

      const { fetchCasesForScorePrediction } = await import('../predictScore');
      const result = await fetchCasesForScorePrediction();

      expect(result.success).toBe(true);
      expect(result.cases).toHaveLength(2);
      expect(result.cases![0].case_id).toBe('case-1');
    });

    it('DBエラー時はエラーを返す', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      const { supabaseAnonServer } = await import('@/lib/supabase/anon-server');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB error' } }),
      };
      vi.mocked(supabaseAnonServer.from).mockReturnValue(mockQuery as any);

      const { fetchCasesForScorePrediction } = await import('../predictScore');
      const result = await fetchCasesForScorePrediction();

      expect(result.success).toBe(false);
      expect(result.error).toContain('取得に失敗');
    });
  });

  // ========================================
  // submitAnswerForScorePrediction
  // ========================================
  describe('submitAnswerForScorePrediction', () => {
    it('caseIdが空の場合はエラー', async () => {
      const { submitAnswerForScorePrediction } = await import('../predictScore');
      const result = await submitAnswerForScorePrediction({
        caseId: '',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('answerTextが空の場合はエラー', async () => {
      const { submitAnswerForScorePrediction } = await import('../predictScore');
      const result = await submitAnswerForScorePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('解答が10文字未満の場合はエラー', async () => {
      const { submitAnswerForScorePrediction } = await import('../predictScore');
      const result = await submitAnswerForScorePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: '短い解答',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('10文字以上');
    });

    it('認証がない場合はエラー', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      vi.mocked(getAnyAccessToken).mockResolvedValue(null);

      const { submitAnswerForScorePrediction } = await import('../predictScore');
      const result = await submitAnswerForScorePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常にスコア予測を実行', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      const { predictScoreFromAnswer } = await import('@/lib/scoring');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');

      const mockPrediction = {
        predictedScores: { problem: 3.5, solution: null },
        confidence: 0.8,
        similarExamples: [],
        explanation: '予測結果の説明',
      };
      vi.mocked(predictScoreFromAnswer).mockResolvedValue(mockPrediction as any);

      const { submitAnswerForScorePrediction } = await import('../predictScore');
      const result = await submitAnswerForScorePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(true);
      expect(result.prediction).toEqual(mockPrediction);
      expect(predictScoreFromAnswer).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'valid-token',
          caseId: 'case-123',
          question: 'q1',
        })
      );
    });

    it('制御文字を除去してサニタイズ', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      const { predictScoreFromAnswer } = await import('@/lib/scoring');
      const { stripControlChars } = await import('@/lib/security');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(predictScoreFromAnswer).mockResolvedValue({
        predictedScores: { problem: 3.0 },
        confidence: 0.7,
        similarExamples: [],
        explanation: '',
      } as any);

      const { submitAnswerForScorePrediction } = await import('../predictScore');
      await submitAnswerForScorePrediction({
        caseId: 'case\x00-123',
        question: 'q1',
        answerText: 'テスト\x00解答です。十分な長さ。',
      });

      expect(stripControlChars).toHaveBeenCalled();
    });

    it('予測エラー時はエラーを返す', async () => {
      const { getAnyAccessToken } = await import('@/lib/supabase/server');
      const { predictScoreFromAnswer } = await import('@/lib/scoring');

      vi.mocked(getAnyAccessToken).mockResolvedValue('valid-token');
      vi.mocked(predictScoreFromAnswer).mockRejectedValue(new Error('予測処理エラー'));

      const { submitAnswerForScorePrediction } = await import('../predictScore');
      const result = await submitAnswerForScorePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('予測処理エラー');
    });
  });
});
