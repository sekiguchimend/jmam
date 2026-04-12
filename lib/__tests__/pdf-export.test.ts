import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted() を使用してモック変数をホイスト
const {
  mockSave,
  mockText,
  mockSetFont,
  mockSetFontSize,
  mockSetTextColor,
  mockAddPage,
  mockAddFileToVFS,
  mockAddFont,
  mockAutoTable,
  mockPdfInstance,
  MockJsPDF,
} = vi.hoisted(() => {
  const mockSave = vi.fn();
  const mockText = vi.fn();
  const mockSetFont = vi.fn();
  const mockSetFontSize = vi.fn();
  const mockSetTextColor = vi.fn();
  const mockAddPage = vi.fn();
  const mockAddFileToVFS = vi.fn();
  const mockAddFont = vi.fn();
  const mockAutoTable = vi.fn();

  // jsPDFインスタンスのモック
  const mockPdfInstance = {
    save: mockSave,
    text: mockText,
    setFont: mockSetFont,
    setFontSize: mockSetFontSize,
    setTextColor: mockSetTextColor,
    addPage: mockAddPage,
    addFileToVFS: mockAddFileToVFS,
    addFont: mockAddFont,
    lastAutoTable: { finalY: 100 },
  };

  // コンストラクタとして使えるモック
  const MockJsPDF = vi.fn(function (this: typeof mockPdfInstance) {
    Object.assign(this, mockPdfInstance);
    return this;
  });

  return {
    mockSave,
    mockText,
    mockSetFont,
    mockSetFontSize,
    mockSetTextColor,
    mockAddPage,
    mockAddFileToVFS,
    mockAddFont,
    mockAutoTable,
    mockPdfInstance,
    MockJsPDF,
  };
});

// モック設定
vi.mock('jspdf', () => ({
  jsPDF: MockJsPDF,
}));

vi.mock('jspdf-autotable', () => ({
  default: mockAutoTable,
}));

// fetch モック
global.fetch = vi.fn(() =>
  Promise.resolve({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
  } as Response)
);

// btoa モック（Vitest環境で利用可能だが念のため）
if (typeof btoa === 'undefined') {
  (global as unknown as { btoa: (s: string) => string }).btoa = (str: string) =>
    Buffer.from(str, 'binary').toString('base64');
}

// トップレベルインポート
import {
  exportAnswerPredictToPdf,
  exportScorePredictToPdf,
  exportNewCasePredictToPdf,
  type AnswerPredictExportData,
  type ScorePredictExportData,
  type NewCasePredictExportData,
} from '../pdf-export';

describe('pdf-export', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // autoTableのfinalYを設定
    mockAutoTable.mockImplementation((pdf: { lastAutoTable: { finalY: number } }) => {
      pdf.lastAutoTable = { finalY: 100 };
    });
  });

  // ========================================
  // exportAnswerPredictToPdf
  // ========================================
  describe('exportAnswerPredictToPdf', () => {
    const sampleData: AnswerPredictExportData = {
      caseName: 'テストケース',
      situationText: 'これはテスト状況の説明です',
      scores: [
        { label: '問題把握', value: 4.0, max: 5 },
        { label: '対策立案', value: 3.5, max: 5 },
      ],
      roleScore: 3.8,
      q1Answer: 'テスト解答1',
      q2Answer: 'テスト解答2',
    };

    it('正常にPDFを生成して保存', async () => {
      await exportAnswerPredictToPdf(sampleData, 'test-answer');

      // jsPDFが初期化されること
      expect(MockJsPDF).toHaveBeenCalledWith({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4',
      });

      // タイトルが出力されること
      expect(mockText).toHaveBeenCalledWith('解答予測結果', 15, 15);

      // ケース名が出力されること
      expect(mockText).toHaveBeenCalledWith(`ケース: ${sampleData.caseName}`, 15, expect.any(Number));

      // PDFが保存されること
      expect(mockSave).toHaveBeenCalledWith('test-answer.pdf');
    });

    it('situationTextが空でもエラーにならない', async () => {
      const dataWithoutSituation = { ...sampleData, situationText: undefined };

      await expect(
        exportAnswerPredictToPdf(dataWithoutSituation, 'test-no-situation')
      ).resolves.toBeUndefined();

      expect(mockSave).toHaveBeenCalledWith('test-no-situation.pdf');
    });

    it('スコアテーブルにautoTableを使用', async () => {
      await exportAnswerPredictToPdf(sampleData, 'test-score-table');

      // autoTableが呼ばれること
      expect(mockAutoTable).toHaveBeenCalled();
    });

    it('フォント読み込みが実行される', async () => {
      await exportAnswerPredictToPdf(sampleData, 'test-font');

      // フォントが追加されること
      expect(mockAddFileToVFS).toHaveBeenCalled();
      expect(mockAddFont).toHaveBeenCalled();
      expect(mockSetFont).toHaveBeenCalledWith('MPlus', 'bold');
    });
  });

  // ========================================
  // exportScorePredictToPdf
  // ========================================
  describe('exportScorePredictToPdf', () => {
    const sampleData: ScorePredictExportData = {
      caseName: 'テストケース',
      situationText: 'テスト状況',
      questionLabel: '設問1',
      answerText: 'テスト解答',
      confidence: 0.85,
      scores: [
        { label: '総合スコア', value: 4.2 },
        {
          label: '詳細スコア',
          value: 4.0,
          children: [
            { label: 'サブ項目1', value: 4 },
            { label: 'サブ項目2', value: 4 },
          ],
        },
      ],
      explanation: 'テスト説明文',
    };

    it('正常にPDFを生成して保存', async () => {
      await exportScorePredictToPdf(sampleData, 'test-score');

      // タイトルに設問ラベルが含まれること
      expect(mockText).toHaveBeenCalledWith(
        `スコア予測結果 - ${sampleData.questionLabel}`,
        15,
        15
      );

      // 信頼度が出力されること
      expect(mockText).toHaveBeenCalledWith(
        `信頼度: ${(sampleData.confidence * 100).toFixed(0)}%`,
        15,
        expect.any(Number)
      );

      expect(mockSave).toHaveBeenCalledWith('test-score.pdf');
    });

    it('類似例がある場合はテーブルを生成', async () => {
      const dataWithExamples = {
        ...sampleData,
        similarExamples: [
          { rank: 1, similarity: 0.95, excerpt: '類似例1' },
          { rank: 2, similarity: 0.88, excerpt: '類似例2' },
        ],
      };

      await exportScorePredictToPdf(dataWithExamples, 'test-with-examples');

      // 類似例のテーブルが生成されること
      expect(mockAutoTable).toHaveBeenCalled();
      expect(mockText).toHaveBeenCalledWith('類似解答例', 15, expect.any(Number));
    });

    it('類似例がない場合もエラーにならない', async () => {
      const dataWithoutExamples = { ...sampleData, similarExamples: undefined };

      await expect(
        exportScorePredictToPdf(dataWithoutExamples, 'test-no-examples')
      ).resolves.toBeUndefined();

      expect(mockSave).toHaveBeenCalledWith('test-no-examples.pdf');
    });

    it('子スコアが正しくフォーマットされる', async () => {
      await exportScorePredictToPdf(sampleData, 'test-children');

      // autoTableが呼ばれること（子スコア含むテーブル）
      expect(mockAutoTable).toHaveBeenCalled();
    });
  });

  // ========================================
  // exportNewCasePredictToPdf
  // ========================================
  describe('exportNewCasePredictToPdf', () => {
    const sampleData: NewCasePredictExportData = {
      caseName: '新規ケース',
      situationText: '新規ケースの状況説明',
      q1Answer: '問題把握の解答',
      q2Answer: '対策立案の解答',
      confidence: 0.78,
      scores: [
        { label: '問題把握', value: 3.5 },
        { label: '対策立案', value: 4.0 },
        { label: '総合', value: 3.75 },
      ],
      explanation: 'これは新規ケースの予測説明です',
    };

    it('正常にPDFを生成して保存', async () => {
      await exportNewCasePredictToPdf(sampleData, 'test-new-case');

      // タイトルが出力されること
      expect(mockText).toHaveBeenCalledWith('スコア予測結果', 15, 15);

      // ケース名が出力されること
      expect(mockText).toHaveBeenCalledWith(`ケース: ${sampleData.caseName}`, 15, expect.any(Number));

      // 信頼度が出力されること
      expect(mockText).toHaveBeenCalledWith(
        `信頼度: ${(sampleData.confidence * 100).toFixed(0)}%`,
        15,
        expect.any(Number)
      );

      expect(mockSave).toHaveBeenCalledWith('test-new-case.pdf');
    });

    it('設問1と設問2の解答セクションが出力される', async () => {
      await exportNewCasePredictToPdf(sampleData, 'test-questions');

      expect(mockText).toHaveBeenCalledWith('設問1の解答（問題把握）', 15, expect.any(Number));
      expect(mockText).toHaveBeenCalledWith('設問2の解答（対策立案）', 15, expect.any(Number));
    });

    it('situationTextが空でもエラーにならない', async () => {
      const dataWithoutSituation = { ...sampleData, situationText: undefined };

      await expect(
        exportNewCasePredictToPdf(dataWithoutSituation, 'test-new-no-situation')
      ).resolves.toBeUndefined();

      expect(mockSave).toHaveBeenCalledWith('test-new-no-situation.pdf');
    });

    it('予測スコアセクションが出力される', async () => {
      await exportNewCasePredictToPdf(sampleData, 'test-scores');

      expect(mockText).toHaveBeenCalledWith('予測スコア', 15, expect.any(Number));
    });

    it('予測の説明セクションが出力される', async () => {
      await exportNewCasePredictToPdf(sampleData, 'test-explanation');

      expect(mockText).toHaveBeenCalledWith('予測の説明', 15, expect.any(Number));
    });
  });

  // ========================================
  // データ型インターフェース
  // ========================================
  describe('export data types', () => {
    it('AnswerPredictExportData型が正しい構造を持つ', () => {
      const data: AnswerPredictExportData = {
        caseName: 'ケース',
        scores: [{ label: 'テスト', value: 1, max: 5 }],
        roleScore: 3,
        q1Answer: '解答1',
        q2Answer: '解答2',
      };

      expect(data.caseName).toBe('ケース');
      expect(data.scores).toHaveLength(1);
      expect(data.roleScore).toBe(3);
    });

    it('ScorePredictExportData型が正しい構造を持つ', () => {
      const data: ScorePredictExportData = {
        caseName: 'ケース',
        questionLabel: '設問',
        answerText: '解答',
        confidence: 0.8,
        scores: [{ label: 'スコア', value: 4 }],
        explanation: '説明',
      };

      expect(data.confidence).toBe(0.8);
      expect(data.scores).toHaveLength(1);
    });

    it('NewCasePredictExportData型が正しい構造を持つ', () => {
      const data: NewCasePredictExportData = {
        caseName: '新規ケース',
        q1Answer: '解答1',
        q2Answer: '解答2',
        confidence: 0.7,
        scores: [],
        explanation: '説明',
      };

      expect(data.q1Answer).toBe('解答1');
      expect(data.q2Answer).toBe('解答2');
    });
  });
});
