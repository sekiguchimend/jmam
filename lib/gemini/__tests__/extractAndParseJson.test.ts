import { describe, it, expect } from 'vitest';
import { extractAndParseJson } from '../client';

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
