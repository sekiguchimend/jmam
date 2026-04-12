import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockIsAdmin,
  mockGetAccessToken,
  mockGetQuestionsByCase,
  mockUpsertQuestion,
  mockDeleteQuestion,
  mockUpdateCaseSituation,
  mockGetCaseById,
  mockEmbedText,
} = vi.hoisted(() => ({
  mockIsAdmin: vi.fn(),
  mockGetAccessToken: vi.fn(),
  mockGetQuestionsByCase: vi.fn(),
  mockUpsertQuestion: vi.fn(),
  mockDeleteQuestion: vi.fn(),
  mockUpdateCaseSituation: vi.fn(),
  mockGetCaseById: vi.fn(),
  mockEmbedText: vi.fn(),
}));

// モック設定
vi.mock('@/lib/supabase/server', () => ({
  isAdmin: mockIsAdmin,
  getAccessToken: mockGetAccessToken,
}));

vi.mock('@/lib/supabase/queries', () => ({
  getQuestionsByCase: mockGetQuestionsByCase,
  upsertQuestion: mockUpsertQuestion,
  deleteQuestion: mockDeleteQuestion,
  updateCaseSituation: mockUpdateCaseSituation,
  getCaseById: mockGetCaseById,
}));

vi.mock('@/lib/gemini', () => ({
  embedText: mockEmbedText,
}));

// トップレベルインポート
import {
  fetchQuestions,
  saveQuestion,
  removeQuestion,
  saveCaseSituation,
} from '../questions';

describe('questions actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ========================================
  // fetchQuestions
  // ========================================
  describe('fetchQuestions', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await fetchQuestions('case-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      const result = await fetchQuestions('case-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('トークンが見つかりません');
    });

    it('正常に設問を取得', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockGetQuestionsByCase.mockResolvedValue([
        { case_id: 'case-123', question_key: 'q1', question_text: '設問1' },
        { case_id: 'case-123', question_key: 'q2', question_text: '設問2' },
      ]);
      mockGetCaseById.mockResolvedValue({
        case_id: 'case-123',
        situation_text: 'ケースの状況説明',
      });

      const result = await fetchQuestions('case-123');

      expect(result.success).toBe(true);
      expect(result.questions).toHaveLength(2);
      expect(result.situationText).toBe('ケースの状況説明');
    });

    it('エラー時はエラーメッセージを返す', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockGetQuestionsByCase.mockRejectedValue(new Error('DB接続エラー'));

      const result = await fetchQuestions('case-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('DB接続エラー');
    });
  });

  // ========================================
  // saveQuestion
  // ========================================
  describe('saveQuestion', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await saveQuestion({
        caseId: 'case-123',
        questionKey: 'q1',
        questionText: 'テスト設問',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('caseIdが空の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const result = await saveQuestion({
        caseId: '',
        questionKey: 'q1',
        questionText: 'テスト設問',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('questionTextが空の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const result = await saveQuestion({
        caseId: 'case-123',
        questionKey: 'q1',
        questionText: '   ', // 空白のみ
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('トークンがない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue(null);

      const result = await saveQuestion({
        caseId: 'case-123',
        questionKey: 'q1',
        questionText: 'テスト設問',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('トークンが見つかりません');
    });

    it('正常に設問を保存', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockEmbedText.mockResolvedValue({ values: [0.1, 0.2, 0.3] });
      mockUpsertQuestion.mockResolvedValue(undefined);

      const result = await saveQuestion({
        caseId: 'case-123',
        questionKey: 'q1',
        questionText: 'テスト設問',
      });

      expect(result.success).toBe(true);
      expect(mockEmbedText).toHaveBeenCalledWith('テスト設問');
      expect(mockUpsertQuestion).toHaveBeenCalledWith(
        expect.objectContaining({
          case_id: 'case-123',
          question_key: 'q1',
          question_text: 'テスト設問',
          question_embedding: [0.1, 0.2, 0.3],
        }),
        'valid-token'
      );
    });
  });

  // ========================================
  // removeQuestion
  // ========================================
  describe('removeQuestion', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await removeQuestion({
        caseId: 'case-123',
        questionKey: 'q1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('caseIdが空の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const result = await removeQuestion({
        caseId: '',
        questionKey: 'q1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('正常に設問を削除', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockDeleteQuestion.mockResolvedValue(undefined);

      const result = await removeQuestion({
        caseId: 'case-123',
        questionKey: 'q1',
      });

      expect(result.success).toBe(true);
      expect(mockDeleteQuestion).toHaveBeenCalledWith('case-123', 'q1', 'valid-token');
    });
  });

  // ========================================
  // saveCaseSituation
  // ========================================
  describe('saveCaseSituation', () => {
    it('管理者でない場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(false);

      const result = await saveCaseSituation({
        caseId: 'case-123',
        situationText: 'ケースの状況説明',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('管理者権限がありません');
    });

    it('caseIdが空の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const result = await saveCaseSituation({
        caseId: '',
        situationText: 'ケースの状況説明',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('situationTextが空の場合はエラー', async () => {
      mockIsAdmin.mockResolvedValue(true);

      const result = await saveCaseSituation({
        caseId: 'case-123',
        situationText: '   ', // 空白のみ
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('必須');
    });

    it('正常にケース内容を保存', async () => {
      mockIsAdmin.mockResolvedValue(true);
      mockGetAccessToken.mockResolvedValue('valid-token');
      mockEmbedText.mockResolvedValue({ values: [0.4, 0.5, 0.6] });
      mockUpdateCaseSituation.mockResolvedValue(undefined);

      const result = await saveCaseSituation({
        caseId: 'case-123',
        situationText: 'ケースの状況説明',
      });

      expect(result.success).toBe(true);
      expect(mockEmbedText).toHaveBeenCalledWith('ケースの状況説明');
      expect(mockUpdateCaseSituation).toHaveBeenCalledWith(
        'case-123',
        expect.objectContaining({
          situation_text: 'ケースの状況説明',
          situation_embedding: [0.4, 0.5, 0.6],
        }),
        'valid-token'
      );
    });
  });
});
