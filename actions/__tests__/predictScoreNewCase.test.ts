import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockGetAnyAccessToken,
  mockPredictScoreForNewCase,
  mockPredictScoreFromAnswer,
} = vi.hoisted(() => ({
  mockGetAnyAccessToken: vi.fn(),
  mockPredictScoreForNewCase: vi.fn(),
  mockPredictScoreFromAnswer: vi.fn(),
}));

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  getAnyAccessToken: mockGetAnyAccessToken,
}));

vi.mock('@/lib/supabase/anon-server', () => ({
  supabaseAnonServer: {
    from: vi.fn(),
  },
}));

vi.mock('@/lib/scoring', () => ({
  predictScoreForNewCase: mockPredictScoreForNewCase,
  predictScoreFromAnswer: mockPredictScoreFromAnswer,
}));

vi.mock('@/lib/security', () => ({
  stripControlChars: vi.fn((s: string) => s.replace(/[\x00-\x1F\x7F]/g, '')),
  truncateString: vi.fn((s: string, len: number) => s.slice(0, len)),
}));

vi.mock('@/actions/predictionHistory', () => ({
  savePredictionHistoryExisting: vi.fn().mockResolvedValue(undefined),
  savePredictionHistoryNew: vi.fn().mockResolvedValue(undefined),
}));

// トップレベルインポート
import {
  submitAnswerForNewCasePrediction,
  submitAnswerForExistingCasePrediction,
  submitCombinedPrediction,
  submitCombinedNewCasePrediction,
} from '../predictScoreNewCase';

describe('predictScoreNewCase actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // submitAnswerForNewCasePrediction
  // ========================================
  describe('submitAnswerForNewCasePrediction', () => {
    it('シチュエーションが空の場合はエラー', async () => {
      const result = await submitAnswerForNewCasePrediction({
        situationText: '',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('シチュエーション');
    });

    it('シチュエーションが20文字未満の場合はエラー', async () => {
      const result = await submitAnswerForNewCasePrediction({
        situationText: '短いケース内容',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('20文字以上');
    });

    it('解答が空の場合はエラー', async () => {
      const result = await submitAnswerForNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        question: 'q1',
        answerText: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('解答テキスト');
    });

    it('解答が10文字未満の場合はエラー', async () => {
      const result = await submitAnswerForNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        question: 'q1',
        answerText: '短い解答',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('10文字以上');
    });

    it('認証がない場合はエラー', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);

      const result = await submitAnswerForNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常にスコア予測を実行', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const mockPrediction = {
        predictedScores: { problem: 3.5, solution: null },
        confidence: 0.8,
        similarCases: [],
        similarExamples: [],
        explanation: '予測結果の説明',
      };
      mockPredictScoreForNewCase.mockResolvedValue(mockPrediction);

      const result = await submitAnswerForNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(true);
      expect(result.prediction).toBeDefined();
    });
  });

  // ========================================
  // submitAnswerForExistingCasePrediction
  // ========================================
  describe('submitAnswerForExistingCasePrediction', () => {
    it('caseIdが空の場合はエラー', async () => {
      const result = await submitAnswerForExistingCasePrediction({
        caseId: '',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ケースを選択');
    });

    it('解答が空の場合はエラー', async () => {
      const result = await submitAnswerForExistingCasePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('解答テキスト');
    });

    it('解答が10文字未満の場合はエラー', async () => {
      const result = await submitAnswerForExistingCasePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: '短い解答',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('10文字以上');
    });

    it('認証がない場合はエラー', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);

      const result = await submitAnswerForExistingCasePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常にスコア予測を実行', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const mockResult = {
        predictedScores: { problem: 3.5, solution: null },
        confidence: 0.8,
        similarExamples: [],
        explanation: '予測結果の説明',
      };
      mockPredictScoreFromAnswer.mockResolvedValue(mockResult);

      const result = await submitAnswerForExistingCasePrediction({
        caseId: 'case-123',
        question: 'q1',
        answerText: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(true);
      expect(result.prediction).toBeDefined();
    });
  });

  // ========================================
  // submitCombinedPrediction
  // ========================================
  describe('submitCombinedPrediction', () => {
    it('caseIdが空の場合はエラー', async () => {
      const result = await submitCombinedPrediction({
        caseId: '',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('ケースを選択');
    });

    it('設問1の解答が空の場合はエラー', async () => {
      const result = await submitCombinedPrediction({
        caseId: 'case-123',
        q1Answer: '',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問1');
    });

    it('設問1の解答が10文字未満の場合はエラー', async () => {
      const result = await submitCombinedPrediction({
        caseId: 'case-123',
        q1Answer: '短い解答',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問1');
      expect(result.error).toContain('10文字以上');
    });

    it('設問2の解答が空の場合はエラー', async () => {
      const result = await submitCombinedPrediction({
        caseId: 'case-123',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問2');
    });

    it('設問2の解答が10文字未満の場合はエラー', async () => {
      const result = await submitCombinedPrediction({
        caseId: 'case-123',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: '短い解答',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問2');
      expect(result.error).toContain('10文字以上');
    });

    it('認証がない場合はエラー', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);

      const result = await submitCombinedPrediction({
        caseId: 'case-123',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });
  });

  // ========================================
  // submitCombinedNewCasePrediction
  // ========================================
  describe('submitCombinedNewCasePrediction', () => {
    it('シチュエーションが空の場合はエラー', async () => {
      const result = await submitCombinedNewCasePrediction({
        situationText: '',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('シチュエーション');
    });

    it('シチュエーションが20文字未満の場合はエラー', async () => {
      const result = await submitCombinedNewCasePrediction({
        situationText: '短いケース内容',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('20文字以上');
    });

    it('設問1の解答が空の場合はエラー', async () => {
      const result = await submitCombinedNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        q1Answer: '',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問1');
    });

    it('設問1の解答が10文字未満の場合はエラー', async () => {
      const result = await submitCombinedNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        q1Answer: '短い解答',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問1');
      expect(result.error).toContain('10文字以上');
    });

    it('設問2の解答が空の場合はエラー', async () => {
      const result = await submitCombinedNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: '',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問2');
    });

    it('設問2の解答が10文字未満の場合はエラー', async () => {
      const result = await submitCombinedNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: '短い解答',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('設問2');
      expect(result.error).toContain('10文字以上');
    });

    it('認証がない場合はエラー', async () => {
      mockGetAnyAccessToken.mockResolvedValue(null);

      const result = await submitCombinedNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('認証が必要です');
    });

    it('正常にスコア予測を実行', async () => {
      mockGetAnyAccessToken.mockResolvedValue('valid-token');

      const mockPrediction = {
        predictedScores: { problem: 3.5, solution: 4.0 },
        confidence: 0.8,
        similarCases: [],
        similarExamples: [],
        explanation: '予測結果の説明',
      };
      mockPredictScoreForNewCase.mockResolvedValue(mockPrediction);

      const result = await submitCombinedNewCasePrediction({
        situationText: 'これは十分な長さのシチュエーションテキストです。',
        q1Answer: 'これはテスト解答です。十分な長さがあります。',
        q2Answer: 'これはテスト解答です。十分な長さがあります。',
      });

      expect(result.success).toBe(true);
      expect(result.result).toBeDefined();
      expect(result.result?.isNewCase).toBe(true);
    });
  });
});
