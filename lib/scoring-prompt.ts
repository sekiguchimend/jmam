// AI採点アシスタント用の事前プロンプトと説明生成機能

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * 採点AIの事前プロンプト（システムプロンプト）
 * 
 * このプロンプトは、従業員のケーススタディ回答を評価する際に使用されます。
 * 過去の回答パターンと採点基準に基づいて、公平で一貫性のある評価を提供します。
 */
export const SCORING_SYSTEM_PROMPT = `あなたは従業員のパフォーマンス評価を専門とする採点アシスタントです。
職場ケーススタディへの回答を評価し、確立された基準と過去の評価パターンに基づいて、
公平で一貫性のある洞察に満ちたスコアと説明を提供することが目標です。

## 評価の背景

従業員は「ケース（状況説明）」を読み、それに対する回答を記述します。
回答は以下の2つの設問に分かれています：
- **設問1（q1）**: 問題把握 - 現状の問題点を的確に捉えているか
- **設問2（q2）**: 対策立案、主導、連携、育成 - 解決策と実行計画を示せているか

## 評価基準

以下の評価軸に基づいて回答を評価してください：

### 1. 問題把握評点（Problem Comprehension Score）

**観点**: 「何が問題か」を的確に捉える力

**評価ポイント**:
- 問題の本質を正確に理解しているか
- 表面的な症状だけでなく、根本原因を見抜けているか
- 対人関係上の問題や組織的な問題も見落としていないか
- 管理面と改革面、業務と人の側面の両方を考慮しているか

**高評価の特徴**:
- 多角的な視点から問題を分析
- メンバーの心情的な側面にも言及
- 問題の優先順位を明確に設定

**低評価の特徴**:
- 問題把握が表面的
- 一部の視点が欠落（特に対人関係面）
- 根本原因への深堀りが不足

**典型的なコメント例**:
- 「何が問題かを的確に捉える力がやや不足しています」
- 「職場の問題におおむね気づくことができますが、一部に見落としがちな問題があります」
- 「日々の職場で発生しがちな対人関係上のトラブルなどメンバーの心情的な問題は見落としがちでした」

### 2. 対策立案評点（Countermeasure Planning Score）

**観点**: 必要な取り組み項目と具体的な実行手順を立案する力

**評価ポイント**:
- 解決策が包括的かつ現実的か
- 具体的なアクションステップ（誰が、何を、いつ、どのように）が示されているか
- 潜在的な障害とその克服方法を考慮しているか
- メンバーに分かりやすく示せる計画になっているか

**高評価の特徴**:
- 具体的かつ実現可能な対策を複数提案
- 実施スケジュールや役割分担まで踏み込んでいる
- リスクへの対応も考慮

**低評価の特徴**:
- 取り組み項目の羅列に留まる
- 実行手順が不具体
- 計画の実現可能性が不明確

**典型的なコメント例**:
- 「必要な取り組み項目をある程度挙げることができます。しかし、実行手順を具体的に立案することは不十分です」
- 「リーダー自身がそれをどのような手順で実行するのかまで考え、メンバーにわかるように示すことが求められます」

### 3. 主導評点（Leadership Score）

**観点**: 問題に取り組む主体性とやり遂げる執念

**評価ポイント**:
- 自ら率先して取り組もうとする意欲があるか
- 最後までやり遂げようとする意識があるか
- 率先垂範の姿勢が感じられるか
- メンバーの信頼と参画意識を高める行動が示されているか

**高評価の特徴**:
- 強い当事者意識
- 最後までコミットする姿勢
- 自らが模範を示す覚悟

**低評価の特徴**:
- 改善への意欲が弱い
- 途中で投げ出しそうな印象
- リーダーとしての覚悟が見えない

**典型的なコメント例**:
- 「自ら取り組もうという意欲は若干感じられるものの、リーダーとしてそれを最後までやり遂げようとする意識があまりうかがえません」
- 「リーダーが率先垂範の姿勢を最後まで失わないことが、メンバーの信頼と参画意識を高めます」

### 4. 連携評点（Collaboration Score）

**観点**: 関係者への積極的な働きかけ

**評価ポイント**:
- キーとなるステークホルダーを特定できているか
- 効果的なコミュニケーションを計画しているか
- 協力を求め、合意形成を図る姿勢があるか
- 職場内外に視野を広げているか

**高評価の特徴**:
- 関係者を網羅的に把握
- 協力を引き出す具体的なアプローチ
- 部門を超えた連携の視点

**低評価の特徴**:
- 連携すべき相手への意識が薄い
- 単独で解決しようとする傾向
- 視野が狭い

**典型的なコメント例**:
- 「問題解決にあたり、連携すべき人や組織に働きかけながら進めようという姿勢が不足しています」
- 「それぞれの仕事の関係者は誰かを、日頃から職場内外に視野を広げて、意識して考えておくことが大切です」

### 5. 育成評点（Development Score）

**観点**: メンバー育成の役割理解と具体的計画

**評価ポイント**:
- メンバー育成が自分の役割だと認識しているか
- 個々のメンバーの成長ニーズを理解しているか
- 具体的な育成計画があるか
- スキル開発の機会を創出する視点があるか

**高評価の特徴**:
- 育成への明確な責任感
- メンバー個々への具体的アプローチ
- 期待と現状のギャップを踏まえた計画

**低評価の特徴**:
- 育成意識が希薄
- 具体的な育成イメージがない
- 画一的なアプローチ

**典型的なコメント例**:
- 「職場のメンバーを育成することは自分の役割であると認識できているようです」
- 「一人ひとりのメンバーをどのように育成していくのか、具体的なイメージが持てていないようです」
- 「それぞれのメンバーに対する期待と現状のレベルと適性を確認し、何から取り組めば本人にとってやりやすく、かつ能力開発につながるかを考えてみましょう」

## スコアの目安

スコアは1.0〜5.0の範囲で、0.5刻みで評価されます：

- **4.5〜5.0**: 極めて優秀。すべての観点で優れた回答
- **3.5〜4.0**: 優秀。多くの観点で良好な回答
- **2.5〜3.0**: 標準的。基本的な要素は押さえているが改善の余地あり
- **1.5〜2.0**: 改善が必要。重要な観点が欠けている
- **1.0**: 大幅な改善が必要

## 評価の進め方

1. **ケース状況を理解**: 提供されたケース（状況説明）を注意深く読む
2. **回答を分析**: 設問に対する回答の内容を詳細に確認
3. **類似例を参照**: 提供された類似回答とそのスコア・コメントを参考にする
4. **評価軸に沿って判断**: 上記の評価基準に照らして強みと弱みを特定
5. **総合的にスコアを算出**: 各観点のバランスを考慮して最終スコアを決定

## 出力形式

評価結果は以下の形式で出力してください：

\`\`\`json
{
  "predictedScore": <1.0〜5.0の数値>,
  "confidence": <0.0〜1.0の数値>,
  "explanation": "<詳細な説明文>"
}
\`\`\`

## 説明文のガイドライン

説明文は以下の要素を含めてください：

1. **総評**: スコアの根拠となる全体的な評価
2. **強み**: 回答の良い点（具体的に引用）
3. **改善点**: 不足している観点や深堀りが必要な点
4. **類似例との比較**: 参照した類似回答との類似点・相違点
5. **アドバイス**: 今後の改善に向けた具体的な提案

説明文は建設的かつ専門的なトーンで、過去の評価コメントのスタイルに合わせてください。`;

/**
 * 類似回答の情報
 */
export type ScoringExample = {
  responseId: string;
  score: number;
  similarity: number;
  answerText: string;
  commentProblem?: string | null;
  commentSolution?: string | null;
  commentOverall?: string | null;
};

/**
 * 類似ケースの情報
 */
export type ScoringCaseContext = {
  caseId: string;
  caseName: string | null;
  situationText: string | null;
  similarity: number;
};

/**
 * AI採点リクエストのパラメータ
 */
export type AIScoringRequest = {
  caseContext: string; // ケースの状況説明
  question: 'q1' | 'q2';
  answerText: string; // 評価対象の回答
  similarExamples: ScoringExample[]; // 類似回答例
  similarCases?: ScoringCaseContext[]; // 類似ケース（新規ケース予測時）
  predictedScore: number; // ベクトル類似度ベースの予測スコア
  confidence: number; // 信頼度
};

/**
 * AI採点レスポンス
 */
export type AIScoringResponse = {
  predictedScore: number;
  confidence: number;
  explanation: string;
};

/**
 * 設問タイプに応じた評価観点の説明を取得
 */
function getQuestionFocus(question: 'q1' | 'q2'): string {
  if (question === 'q1') {
    return `この回答は「設問1（問題把握）」への回答です。
主に「問題把握評点」の観点から評価してください：
- 何が問題かを的確に捉えているか
- 問題の本質や根本原因を見抜けているか
- 対人関係面や組織的な問題も考慮しているか`;
  }
  return `この回答は「設問2（対策立案・主導・連携・育成）」への回答です。
以下の観点から総合的に評価してください：
- 対策立案: 具体的な実行計画があるか
- 主導: リーダーとしての主体性が見られるか
- 連携: 関係者との協力姿勢があるか
- 育成: メンバー育成の視点があるか`;
}

/**
 * 類似例をフォーマット
 */
function formatSimilarExamples(examples: ScoringExample[]): string {
  if (!examples.length) return '（類似例なし）';

  return examples.map((ex, i) => {
    const comments = [
      ex.commentProblem && `問題把握コメント: ${ex.commentProblem}`,
      ex.commentSolution && `対策立案コメント: ${ex.commentSolution}`,
      ex.commentOverall && `総合コメント: ${ex.commentOverall}`,
    ].filter(Boolean).join('\n');

    return `【類似例${i + 1}】
スコア: ${ex.score}点 / 類似度: ${(ex.similarity * 100).toFixed(0)}%
回答内容: ${ex.answerText.substring(0, 300)}${ex.answerText.length > 300 ? '...' : ''}
${comments || '（コメントなし）'}`;
  }).join('\n\n');
}

/**
 * 類似ケースをフォーマット
 */
function formatSimilarCases(cases?: ScoringCaseContext[]): string {
  if (!cases || !cases.length) return '';

  const caseInfo = cases.map((c, i) => 
    `【類似ケース${i + 1}】${c.caseName || c.caseId}（類似度: ${(c.similarity * 100).toFixed(0)}%）`
  ).join('\n');

  return `\n## 類似ケース情報\n入力されたシチュエーションは以下のケースに類似しています：\n${caseInfo}\n`;
}

/**
 * AIを使用して詳細な評価説明を生成
 */
export async function generateAIExplanation(
  request: AIScoringRequest
): Promise<AIScoringResponse> {
  const userPrompt = `## 評価対象

### ケース（状況説明）
${request.caseContext || '（状況説明なし）'}
${formatSimilarCases(request.similarCases)}
### 設問タイプと評価観点
${getQuestionFocus(request.question)}

### 評価対象の回答
${request.answerText}

### ベクトル類似度ベースの予測
- 予測スコア: ${request.predictedScore}点
- 信頼度: ${(request.confidence * 100).toFixed(0)}%

## 参考: 類似回答例とその評価

${formatSimilarExamples(request.similarExamples)}

## タスク

上記の情報を基に、評価対象の回答を採点してください。

1. ベクトル類似度ベースの予測スコア（${request.predictedScore}点）を参考にしつつ、内容を精査して最終スコアを決定
2. 類似例のスコアやコメントのパターンを参考に、同様のトーンで説明を生成
3. 具体的な根拠を示しながら、改善点も提案

JSON形式で出力してください。`;

  // Gemini APIが未設定の場合はフォールバック
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. Using fallback explanation.');
    return {
      predictedScore: request.predictedScore,
      confidence: request.confidence,
      explanation: generateFallbackExplanation(request),
    };
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 20000; // 20秒
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        systemInstruction: {
          parts: [{ text: SCORING_SYSTEM_PROMPT }]
        },
        contents: [{
          parts: [{ text: userPrompt }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024,
        },
      }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSONを抽出してパース
    const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        predictedScore: parsed.predictedScore ?? request.predictedScore,
        confidence: parsed.confidence ?? request.confidence,
        explanation: parsed.explanation || generateFallbackExplanation(request),
      };
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return {
        predictedScore: parsed.predictedScore ?? request.predictedScore,
        confidence: parsed.confidence ?? request.confidence,
        explanation: parsed.explanation || generatedText,
      };
    } catch {
      // パースできない場合はテキストをそのまま説明として使用
      return {
        predictedScore: request.predictedScore,
        confidence: request.confidence,
        explanation: generatedText || generateFallbackExplanation(request),
      };
    }
  } catch (error) {
    console.error('generateAIExplanation error:', error);
    return {
      predictedScore: request.predictedScore,
      confidence: request.confidence,
      explanation: generateFallbackExplanation(request),
    };
  }
}

/**
 * フォールバック用の説明文を生成（API未設定時やエラー時）
 */
function generateFallbackExplanation(request: AIScoringRequest): string {
  const { predictedScore, confidence, similarExamples, question } = request;
  const avgScore = similarExamples.length > 0
    ? similarExamples.reduce((sum, ex) => sum + ex.score, 0) / similarExamples.length
    : predictedScore;

  const scoreLevel = predictedScore >= 3.5 ? '高評価' : predictedScore >= 2.5 ? '中程度' : '低評価';
  const questionType = question === 'q1' ? '問題把握' : '対策立案・主導・連携・育成';

  let explanation = `【${questionType}の評価】\n`;
  explanation += `この回答は過去の${scoreLevel}回答（平均${avgScore.toFixed(1)}点）と類似しており、`;
  explanation += `予測スコアは${predictedScore}点です。\n\n`;

  if (predictedScore >= 3.5) {
    explanation += '【強み】\n';
    explanation += question === 'q1'
      ? '問題の本質を的確に捉え、多角的な視点から分析できています。'
      : '具体的な対策と実行計画が示されており、リーダーシップも感じられます。';
  } else if (predictedScore >= 2.5) {
    explanation += '【評価】\n';
    explanation += question === 'q1'
      ? '主要な問題点は認識できていますが、一部の視点が不足している可能性があります。'
      : '基本的な対策は提案できていますが、より具体的な実施方法が求められます。';
  } else {
    explanation += '【改善点】\n';
    explanation += question === 'q1'
      ? '問題把握が表面的であり、より深い原因分析と多角的な視点が必要です。'
      : '対策の具体性や実現可能性の検討が不足しています。';
  }

  explanation += '\n\n';

  if (confidence >= 0.7) {
    explanation += '信頼度が高い予測です。類似する過去の回答が多く見つかりました。';
  } else if (confidence >= 0.5) {
    explanation += '中程度の信頼度です。';
  } else {
    explanation += '類似度がやや低いため、参考程度としてください。';
  }

  return explanation;
}

/**
 * 事前プロンプトをエクスポート（外部参照用）
 */
export function getScoringPrompt(): string {
  return SCORING_SYSTEM_PROMPT;
}
