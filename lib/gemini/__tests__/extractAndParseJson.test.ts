import { describe, it, expect } from 'vitest';
import { extractAndParseJson, sanitizeAnswerText } from '../client';

describe('extractAndParseJson', () => {
  // ===========================================
  // パターン1: ```json ... ``` (標準的なマークダウンコードブロック)
  // ===========================================
  describe('Pattern 1: Standard markdown JSON code block', () => {
    it('should parse standard ```json block with proper formatting', () => {
      const input = `Here is the response:
\`\`\`json
{
  "q1Answer": "設問1の回答です",
  "q1Reason": "理由1",
  "q2Answer": "設問2の回答です",
  "q2Reason": "理由2"
}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('設問1の回答です');
      expect(result?.q1Reason).toBe('理由1');
      expect(result?.q2Answer).toBe('設問2の回答です');
      expect(result?.q2Reason).toBe('理由2');
    });

    it('should parse ```json block with extra whitespace', () => {
      const input = `\`\`\`json

  {
    "q1Answer": "回答1",
    "q2Answer": "回答2"
  }

\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('回答1');
      expect(result?.q2Answer).toBe('回答2');
    });

    it('should parse ```json block with inline formatting', () => {
      const input = '\`\`\`json\n{"q1Answer":"回答1","q2Answer":"回答2"}\n\`\`\`';
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('回答1');
      expect(result?.q2Answer).toBe('回答2');
    });

    it('should parse ```json block with Japanese text containing special characters', () => {
      const input = `\`\`\`json
{
  "q1Answer": "グルマン館の特注ポトフ、仕様違いによる緊急の作り直しが宮本を萎縮させ、必要な確認ができない状態にある。",
  "q2Answer": "私が宮本に寄り添い、心理的安全性を確保する。"
}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('グルマン館');
      expect(result?.q2Answer).toContain('心理的安全性');
    });

    it('should parse ```json block with newlines in answer text', () => {
      const input = `\`\`\`json
{
  "q1Answer": "問題点1\\n問題点2\\n問題点3",
  "q2Answer": "対策1\\n対策2"
}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('問題点1\n問題点2\n問題点3');
    });
  });

  // ===========================================
  // パターン2: ``` ... ``` (言語指定なしのコードブロック)
  // ===========================================
  describe('Pattern 2: Code block without language specifier', () => {
    it('should parse code block without json specifier', () => {
      const input = `\`\`\`
{
  "q1Answer": "言語指定なし回答1",
  "q2Answer": "言語指定なし回答2"
}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('言語指定なし回答1');
      expect(result?.q2Answer).toBe('言語指定なし回答2');
    });

    it('should parse code block with only whitespace before JSON', () => {
      const input = `\`\`\`
  {"q1Answer":"テスト1","q2Answer":"テスト2"}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('テスト1');
    });
  });

  // ===========================================
  // パターン3: 生のJSONテキスト
  // ===========================================
  describe('Pattern 3: Raw JSON text', () => {
    it('should parse raw JSON directly', () => {
      const input = '{"q1Answer":"直接JSON回答1","q2Answer":"直接JSON回答2"}';
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('直接JSON回答1');
      expect(result?.q2Answer).toBe('直接JSON回答2');
    });

    it('should parse raw JSON with formatting', () => {
      const input = `{
  "q1Answer": "整形されたJSON回答1",
  "q1Reason": "理由1",
  "q2Answer": "整形されたJSON回答2",
  "q2Reason": "理由2"
}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('整形されたJSON回答1');
      expect(result?.q2Reason).toBe('理由2');
    });
  });

  // ===========================================
  // パターン4 & 5: テキスト中のJSONオブジェクト抽出
  // ===========================================
  describe('Pattern 4 & 5: Extract JSON from mixed text', () => {
    it('should extract JSON from text with prefix', () => {
      const input = `以下が回答です：
{"q1Answer":"抽出回答1","q2Answer":"抽出回答2"}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('抽出回答1');
      expect(result?.q2Answer).toBe('抽出回答2');
    });

    it('should extract JSON from text with prefix and suffix', () => {
      const input = `回答を生成しました：
{
  "q1Answer": "前後テキスト付き回答1",
  "q2Answer": "前後テキスト付き回答2"
}
以上です。`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('前後テキスト付き回答1');
      expect(result?.q2Answer).toBe('前後テキスト付き回答2');
    });

    it('should extract JSON when text starts with "json" (no backticks)', () => {
      // これは画像で見られた実際の問題パターン
      const input = `json
{
  "q1Answer": "グルマン館の特注ポトフ、仕様違いによる緊急の作り直し",
  "q2Answer": "私が宮本を萎縮させ"
}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('グルマン館');
    });

    it('should handle complex nested JSON extraction', () => {
      const input = `Here is the analysis:

Based on the situation, I've generated the following response:

{
  "q1Answer": "複雑なテキスト内のJSON回答1",
  "q1Reason": "・理由ポイント1\\n・理由ポイント2",
  "q2Answer": "複雑なテキスト内のJSON回答2",
  "q2Reason": "対策の理由"
}

This response addresses all the key points mentioned in the case study.`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('複雑なテキスト内のJSON回答1');
      expect(result?.q2Answer).toBe('複雑なテキスト内のJSON回答2');
    });
  });

  // ===========================================
  // 実際のGeminiレスポンスシミュレーション
  // ===========================================
  describe('Real Gemini response simulations', () => {
    it('should handle typical successful Gemini response', () => {
      const input = `\`\`\`json
{
  "q1Answer": "特注グラタン仕様違いの納品トラブルは確認ミスではなく、商品開発プロセスの情報共有体制の脆弱さを示す。水木のメンタル面の問題は大岩の指導方法に起因、根本には「既存のやり方への固執」というチーム全体の文化的課題がある。",
  "q1Reason": "・問題間の因果関係を分析\\n・業務面と人的面の両方を捉えた\\n・組織文化の課題まで言及",
  "q2Answer": "私がグルメ堂を訪問し謝罪と対応策を説明、水木を同行させ顧客対応を学ばせる。大岩と1on1面談で指導方法改善を話し合う。",
  "q2Reason": "・具体的アクションを明示\\n・育成の視点を含む\\n・連携を示した"
}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('特注グラタン');
      expect(result?.q2Answer).toContain('私がグルメ堂を訪問');
      expect(result?.q1Reason).toContain('問題間の因果関係');
      expect(result?.q2Reason).toContain('具体的アクション');
    });

    it('should handle Gemini response with extra explanation', () => {
      const input = `I'll generate a response based on the given situation and target scores.

\`\`\`json
{
  "q1Answer": "説明付きレスポンス回答1",
  "q2Answer": "説明付きレスポンス回答2"
}
\`\`\`

This response should achieve the target scores because it addresses all key points.`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('説明付きレスポンス回答1');
      expect(result?.q2Answer).toBe('説明付きレスポンス回答2');
    });

    it('should handle malformed response where backticks are missing', () => {
      // バッククォートが欠けている場合
      const input = `json
{
  "q1Answer": "バッククォートなし回答1",
  "q2Answer": "バッククォートなし回答2"
}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('バッククォートなし回答1');
    });

    it('should handle response with only partial JSON markers', () => {
      const input = `{
  "q1Answer": "部分マーカー回答1",
  "q2Answer": "部分マーカー回答2"
}
\`\`\``;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('部分マーカー回答1');
    });
  });

  // ===========================================
  // エッジケース
  // ===========================================
  describe('Edge cases', () => {
    it('should return null for empty string', () => {
      const result = extractAndParseJson('');
      expect(result).toBeNull();
    });

    it('should return null for whitespace only', () => {
      const result = extractAndParseJson('   \n\t  ');
      expect(result).toBeNull();
    });

    it('should return null for non-JSON text', () => {
      const result = extractAndParseJson('This is just plain text without any JSON.');
      expect(result).toBeNull();
    });

    it('should return null for invalid JSON', () => {
      const input = '{"q1Answer": "unclosed string}';
      const result = extractAndParseJson(input);
      expect(result).toBeNull();
    });

    it('should return null for JSON without q1Answer or q2Answer', () => {
      const input = '{"foo": "bar", "baz": 123}';
      const result = extractAndParseJson(input);
      expect(result).toBeNull();
    });

    it('should extract object from array JSON as fallback (edge case)', () => {
      // 配列JSONはGeminiから返されないが、パターン5のフォールバックで
      // 配列内のオブジェクトが抽出される場合がある
      const input = '[{"q1Answer": "array element"}]';
      const result = extractAndParseJson(input);
      // 内部のオブジェクトが抽出される（フォールバック動作）
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('array element');
    });

    it('should return null for array JSON without valid answer fields', () => {
      const input = '[{"foo": "bar"}]';
      const result = extractAndParseJson(input);
      expect(result).toBeNull();
    });

    it('should handle JSON with only q1Answer (no q2Answer)', () => {
      const input = '{"q1Answer": "q1のみ"}';
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('q1のみ');
      expect(result?.q2Answer).toBeUndefined();
    });

    it('should handle JSON with only q2Answer (no q1Answer)', () => {
      const input = '{"q2Answer": "q2のみ"}';
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q2Answer).toBe('q2のみ');
      expect(result?.q1Answer).toBeUndefined();
    });

    it('should handle very long answers', () => {
      const longAnswer = 'あ'.repeat(5000);
      const input = `{"q1Answer": "${longAnswer}", "q2Answer": "短い回答"}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe(longAnswer);
      expect(result?.q1Answer?.length).toBe(5000);
    });

    it('should handle answers with special characters', () => {
      const input = `{
  "q1Answer": "特殊文字テスト：\\"引用符\\"、\\n改行、\\tタブ",
  "q2Answer": "絵文字テスト：問題なし"
}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('引用符');
      expect(result?.q1Answer).toContain('\n');
    });

    it('should handle answers with nested braces in text', () => {
      const input = `{
  "q1Answer": "問題点: {A部門}と{B部門}の連携不足",
  "q2Answer": "対策: {優先度高}タスクから着手"
}`;
      const result = extractAndParseJson(input);
      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('{A部門}');
      expect(result?.q2Answer).toContain('{優先度高}');
    });
  });

  // ===========================================
  // 問題報告された実際のケース（画像から）
  // ===========================================
  describe('Reported issue reproduction', () => {
    it('should NOT show raw JSON in q1Answer (the reported bug)', () => {
      // この入力は以前「解答の分離に失敗しました」エラーを引き起こしていた
      const problematicInput = `\`\`\`json
{
  "q1Answer": "グルマン館の特注ポトフ、仕様違いによる緊急の作り直しが宮本を萎縮させ、必要な確認ができない状態にある。課全体の開発"
}
\`\`\``;
      const result = extractAndParseJson(problematicInput);

      // 結果はnullではない
      expect(result).not.toBeNull();
      // q1Answerは生のJSONテキストではなく、実際の回答内容
      expect(result?.q1Answer).not.toContain('```json');
      expect(result?.q1Answer).not.toContain('"q1Answer"');
      expect(result?.q1Answer).toContain('グルマン館');
    });

    it('should handle the exact format from the bug report image', () => {
      // 画像で見られた形式を再現
      const input = `\`\`\`json
{
  "q1Answer": "グルマン館の特注ポトフ、仕様違いによる緊急の作り直しが宮本を萎縮させ、必要な確認ができない状態にある。課全体の開発",
  "q2Answer": "私が率先して問題解決に取り組む"
}
\`\`\``;
      const result = extractAndParseJson(input);

      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('グルマン館');
      expect(result?.q2Answer).toContain('私が率先して');
      // q2Answerが「解答の分離に失敗しました」ではないことを確認
      expect(result?.q2Answer).not.toBe('（解答の分離に失敗しました）');
    });

    it('should handle case where Gemini returns without proper code block markers', () => {
      // バッククォートなしでjsonから始まるケース
      const input = `json
{
  "q1Answer": "グルマン館の特注ポトフ、仕様違いによる緊急の作り直し",
  "q2Answer": "私が宮本を萎縮させ"
}`;
      const result = extractAndParseJson(input);

      expect(result).not.toBeNull();
      expect(result?.q1Answer).toContain('グルマン館');
      // 「解答の分離に失敗しました」が返されないことを確認
      expect(result?.q2Answer).not.toBe('（解答の分離に失敗しました）');
    });
  });

  // ===========================================
  // パフォーマンス・境界値テスト
  // ===========================================
  describe('Performance and boundary tests', () => {
    it('should handle extremely long input efficiently', () => {
      const longPrefix = 'a'.repeat(10000);
      const input = `${longPrefix}
\`\`\`json
{"q1Answer": "長いプレフィックス後の回答", "q2Answer": "テスト"}
\`\`\``;
      const startTime = Date.now();
      const result = extractAndParseJson(input);
      const endTime = Date.now();

      expect(result).not.toBeNull();
      expect(result?.q1Answer).toBe('長いプレフィックス後の回答');
      expect(endTime - startTime).toBeLessThan(100); // 100ms以内
    });

    it('should handle multiple JSON blocks (should pick first valid one)', () => {
      const input = `\`\`\`json
{"q1Answer": "最初のブロック", "q2Answer": "テスト1"}
\`\`\`

\`\`\`json
{"q1Answer": "2番目のブロック", "q2Answer": "テスト2"}
\`\`\``;
      const result = extractAndParseJson(input);

      expect(result).not.toBeNull();
      // 最初のブロックがパースされることを期待
      expect(result?.q1Answer).toBe('最初のブロック');
    });
  });
});

// ===========================================
// sanitizeAnswerText テスト
// ===========================================
describe('sanitizeAnswerText', () => {
  // ===========================================
  // パターン1: **...（評価項目）:** 形式
  // ===========================================
  describe('Pattern 1: **...（評価項目）:** format', () => {
    it('should remove **...（育成・主導）:** pattern', () => {
      const input = '**メンバー育成とコミュニケーション改善（育成・主導）:**\n私がメンバーを育成する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('メンバー育成とコミュニケーション改善\n私がメンバーを育成する。');
    });

    it('should remove **...（連携）:** pattern', () => {
      const input = '**上司との連携強化（連携）:**\n上司に報告する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('上司との連携強化\n上司に報告する。');
    });

    it('should remove multiple evaluation item labels', () => {
      const input = `**問題の分析（問題把握）:**\n問題点を整理する。\n\n**対策の立案（対策立案）:**\n対策を検討する。`;
      const result = sanitizeAnswerText(input);
      expect(result).toBe('問題の分析\n問題点を整理する。\n\n対策の立案\n対策を検討する。');
    });
  });

  // ===========================================
  // パターン2: **評価項目:** 形式（括弧なし）
  // ===========================================
  describe('Pattern 2: **評価項目:** format without parentheses', () => {
    it('should remove **主導:** pattern', () => {
      const input = '**主導:** 私が率先して行動する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('私が率先して行動する。');
    });

    it('should remove **育成:** pattern', () => {
      const input = '**育成:** メンバーの成長を支援する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('メンバーの成長を支援する。');
    });

    it('should remove **連携:** pattern', () => {
      const input = '**連携:** 関係部門と協力する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('関係部門と協力する。');
    });

    it('should remove **対策立案:** pattern', () => {
      const input = '**対策立案:** 具体的な施策を検討する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('具体的な施策を検討する。');
    });
  });

  // ===========================================
  // パターン3: 【...】形式の評価項目ラベル
  // ===========================================
  describe('Pattern 3: 【...】format evaluation item labels', () => {
    it('should remove 【主導で3.5点を達成するには】 pattern', () => {
      const input = '【主導で3.5点を達成するには】私が先頭に立つ。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('私が先頭に立つ。');
    });

    it('should remove 【育成】 pattern', () => {
      const input = '【育成】メンバーの育成計画を立てる。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('メンバーの育成計画を立てる。');
    });

    it('should remove 【連携・育成】 pattern', () => {
      const input = '【連携・育成】上司と相談しながらメンバーを育成する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('上司と相談しながらメンバーを育成する。');
    });
  });

  // ===========================================
  // パターン4: 行頭の "- " の後の評価項目ラベル
  // ===========================================
  describe('Pattern 4: Bullet point with evaluation item label', () => {
    it('should remove "- 問題把握: " pattern', () => {
      const input = '- 問題把握: 現状の問題を分析する';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('- 現状の問題を分析する');
    });

    it('should remove "- 連携：" pattern (full-width colon)', () => {
      const input = '- 連携： 関係部門と協力する';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('- 関係部門と協力する');
    });
  });

  // ===========================================
  // パターン5: 単独の評価項目ラベル行
  // ===========================================
  describe('Pattern 5: Standalone evaluation item label line', () => {
    it('should remove standalone "問題把握:" line', () => {
      const input = '問題把握:\n現状を把握する。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('現状を把握する。');
    });

    it('should remove standalone "育成" line', () => {
      const input = '育成\nメンバーを育てる。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('メンバーを育てる。');
    });
  });

  // ===========================================
  // パターン6: 文中の（評価項目）表記
  // ===========================================
  describe('Pattern 6: Inline （評価項目） notation', () => {
    it('should remove inline （主導・育成） notation', () => {
      const input = '改善を行う（主導・育成）。次のステップに進む。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('改善を行う。次のステップに進む。');
    });

    it('should remove inline （連携） notation', () => {
      const input = '部門間の連携を強化する（連携）。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('部門間の連携を強化する。');
    });

    it('should remove multiple inline notations', () => {
      const input = '問題を分析し（問題把握）、対策を立案する（対策立案）。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('問題を分析し、対策を立案する。');
    });
  });

  // ===========================================
  // 複合パターン
  // ===========================================
  describe('Combined patterns', () => {
    it('should handle multiple patterns in one text', () => {
      const input = `**メンバー育成（育成・主導）:**
【連携で3点を達成】
- 問題把握: 現状分析
改善を行う（連携）。`;
      const result = sanitizeAnswerText(input);
      expect(result).toBe(`メンバー育成

- 現状分析
改善を行う。`);
    });

    it('should preserve normal text without evaluation items', () => {
      const input = '私がグルメ堂を訪問し、謝罪と対応策を説明する。水木を同行させ、顧客対応を学ばせる。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('私がグルメ堂を訪問し、謝罪と対応策を説明する。水木を同行させ、顧客対応を学ばせる。');
    });
  });

  // ===========================================
  // エッジケース
  // ===========================================
  describe('Edge cases', () => {
    it('should handle empty string', () => {
      const result = sanitizeAnswerText('');
      expect(result).toBe('');
    });

    it('should handle null-like input', () => {
      const result = sanitizeAnswerText(null as unknown as string);
      expect(result).toBeNull();
    });

    it('should handle undefined-like input', () => {
      const result = sanitizeAnswerText(undefined as unknown as string);
      expect(result).toBeUndefined();
    });

    it('should collapse multiple consecutive newlines', () => {
      const input = '行1\n\n\n\n\n行2';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('行1\n\n行2');
    });

    it('should trim leading and trailing whitespace', () => {
      const input = '  \n\n前後に空白\n\n  ';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('前後に空白');
    });

    it('should not remove partial matches', () => {
      // "主導権" は "主導" を含むが、評価項目ラベルではない
      const input = '主導権を握る。連携プレーを行う。';
      const result = sanitizeAnswerText(input);
      expect(result).toBe('主導権を握る。連携プレーを行う。');
    });
  });

  // ===========================================
  // 実際の問題報告ケース
  // ===========================================
  describe('Reported issue reproduction', () => {
    it('should sanitize the exact pattern from bug report', () => {
      // 報告された問題パターン: **メンバー育成とコミュニケーション改善（育成・主導）:**
      const input = `**メンバー育成とコミュニケーション改善（育成・主導）:**

私がメンバーとの1on1面談を定期的に実施し、各自の課題や成長ニーズを把握する。`;
      const result = sanitizeAnswerText(input);
      expect(result).not.toContain('**');
      expect(result).not.toContain('（育成・主導）');
      expect(result).toContain('メンバー育成とコミュニケーション改善');
      expect(result).toContain('私がメンバーとの1on1面談');
    });

    it('should handle complex real-world answer with multiple issues', () => {
      const input = `**課題分析と対策立案（問題把握・対策立案）:**

現状の業務プロセスに問題がある。

**チームリーダーシップ（主導）:**

私が率先して改善活動を推進する（主導・連携）。

【育成】メンバーのスキルアップを支援する。`;
      const result = sanitizeAnswerText(input);

      // 評価項目ラベルが削除されていることを確認
      expect(result).not.toContain('**課題分析と対策立案（問題把握・対策立案）:**');
      expect(result).not.toContain('**チームリーダーシップ（主導）:**');
      expect(result).not.toContain('【育成】');
      expect(result).not.toContain('（主導・連携）');

      // 実際の内容は保持されていることを確認
      expect(result).toContain('現状の業務プロセスに問題がある');
      expect(result).toContain('私が率先して改善活動を推進する');
      expect(result).toContain('メンバーのスキルアップを支援する');
    });
  });
});
