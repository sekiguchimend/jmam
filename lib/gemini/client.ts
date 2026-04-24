// Google Gemini API クライアント
// LLMによる解答生成（RAG: Retrieval-Augmented Generation）
// PE-01: 予測応答時間5秒以内を目標

import type { PredictionResponse, Scores, PersonalityTraits } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// q2 用のテキスト結合ヘルパー
function combineQ2Answers(r: { answer_q2?: string | null; answer_q3?: string | null; answer_q4?: string | null; answer_q5?: string | null; answer_q6?: string | null; answer_q7?: string | null; answer_q8?: string | null }): string {
  return [r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8]
    .filter(Boolean)
    .join('\n') || '（なし）';
}

// LLMレスポンスからJSONを抽出してパースするヘルパー（複数パターン対応）
// テスト用にexport
export function extractAndParseJson(text: string): { q1Answer?: string; q1Reason?: string; q2Answer?: string; q2Reason?: string } | null {
  // 結果を検証するヘルパー関数
  const isValidResult = (parsed: unknown): parsed is { q1Answer?: string; q1Reason?: string; q2Answer?: string; q2Reason?: string } => {
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return false;
    }
    const obj = parsed as Record<string, unknown>;
    // q1Answerまたはq2Answerのいずれかが存在する必要がある
    return typeof obj.q1Answer === 'string' || typeof obj.q2Answer === 'string';
  };

  // パターン1: ```json ... ``` (標準的なマークダウンコードブロック)
  const jsonBlockMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1]);
      if (isValidResult(parsed)) {
        return parsed;
      }
    } catch {
      // パースエラーは無視して次のパターンへ
    }
  }

  // パターン2: ``` ... ``` (言語指定なしのコードブロック)
  const codeBlockMatch = text.match(/```\s*([\s\S]*?)\s*```/);
  if (codeBlockMatch) {
    try {
      const parsed = JSON.parse(codeBlockMatch[1]);
      if (isValidResult(parsed)) {
        return parsed;
      }
    } catch {
      // パースエラーは無視して次のパターンへ
    }
  }

  // パターン3: テキスト全体を直接JSONとしてパース
  try {
    const parsed = JSON.parse(text);
    if (isValidResult(parsed)) {
      return parsed;
    }
  } catch {
    // パースエラーは無視して次のパターンへ
  }

  // パターン4: テキスト中の { から始まるJSONオブジェクトを抽出
  // q1Answer と q2Answer を含むJSONオブジェクトを探す
  const jsonObjectMatch = text.match(/\{[\s\S]*?"q1Answer"[\s\S]*?"q2Answer"[\s\S]*?\}/);
  if (jsonObjectMatch) {
    try {
      // 抽出した文字列がネストした { } を含む場合に対応するため、
      // 最初の { から最後の } までを取得
      const startIdx = text.indexOf('{');
      const endIdx = text.lastIndexOf('}');
      if (startIdx !== -1 && endIdx > startIdx) {
        const jsonStr = text.substring(startIdx, endIdx + 1);
        const parsed = JSON.parse(jsonStr);
        if (isValidResult(parsed)) {
          return parsed;
        }
      }
    } catch {
      // パースエラーは無視して次のパターンへ
    }
  }

  // パターン5: 最初の { から最後の } までを抽出してパース（最も緩いパターン）
  const startIdx = text.indexOf('{');
  const endIdx = text.lastIndexOf('}');
  if (startIdx !== -1 && endIdx > startIdx) {
    try {
      const jsonStr = text.substring(startIdx, endIdx + 1);
      const parsed = JSON.parse(jsonStr);
      if (isValidResult(parsed)) {
        return parsed;
      }
    } catch {
      // パースエラーは無視
    }
  }

  // すべてのパターンで失敗
  return null;
}

// 類似解答者の解答を参考にLLMで新たな解答を生成（ユークリッド距離ベース）
export async function generatePredictionFromSimilar(
  situationText: string,
  similarResponses: { answer_q1: string | null; answer_q2: string | null; answer_q3?: string | null; answer_q4?: string | null; answer_q5?: string | null; answer_q6?: string | null; answer_q7?: string | null; answer_q8?: string | null; score_problem: number | null; score_solution: number | null; score_role: number | null; score_leadership: number | null; score_collaboration: number | null; score_development: number | null }[],
  targetScores: Scores,
  personalityTraits?: PersonalityTraits
): Promise<PredictionResponse> {
  // 類似解答者の解答をフォーマット
  const formatSimilarExamples = () => {
    if (!similarResponses.length) return '（類似解答者が見つかりませんでした）';
    return similarResponses.map((r, i) => {
      const scores = `[問題把握:${r.score_problem ?? '-'}, 対策立案:${r.score_solution ?? '-'}, 役割理解:${r.score_role ?? '-'}, 主導:${r.score_leadership ?? '-'}, 連携:${r.score_collaboration ?? '-'}, 育成:${r.score_development ?? '-'}]`;
      return `【類似解答者${i + 1}】${scores}
設問1の解答: ${r.answer_q1 || '（なし）'}
設問2の解答: ${combineQ2Answers(r)}`;
    }).join('\n\n');
  };

  // 目標スコアが高い場合（3.5以上）の追加指示を生成
  const generateHighScoreGuidance = () => {
    const guidance: string[] = [];

    if (targetScores.problem >= 3.5) {
      guidance.push(`【問題把握で${targetScores.problem}点を達成するには】
- 問題間の関連性や因果関係を分析（単なる列挙は不可）
- 根本原因（なぜこの問題が起きているか）を明示
- 業務面と人（心情・モチベーション）の両面から問題を捉える
- 維持管理と改革の両視点を含める
- 優先順位を明確に示す`);
    }

    if (targetScores.solution >= 3.5) {
      guidance.push(`【対策立案で${targetScores.solution}点を達成するには】
- 具体的アクションステップ（誰が、何を、いつ、どのように）を明示
- 短期・中期・長期の対策を整理
- 優先順位と実施スケジュールを示す
- リスクと対応策を含める`);
    }

    if (targetScores.role >= 3.5) {
      guidance.push(`【役割理解で${targetScores.role}点を達成するには】★重要★
※役割理解 = (主導 + 連携 + 育成) ÷ 3 で計算
- 解答内で「私は〜する」「私が〜」という一人称表現を適宜使用（ただし冒頭からではなく内容の中で）
- 組織における自分の立場と責任を明示
- 上司への報告・相談、部下への指示・支援、関係部門との調整を具体的に記述
- 「〜すべき」ではなく「私が〜を実行する」という当事者意識`);
    }

    if (targetScores.leadership >= 3.5) {
      guidance.push(`【主導で${targetScores.leadership}点を達成するには】
- 解答内で「私が率先して〜」「私が先頭に立って〜」という表現を使用
- 困難でも最後までやり遂げる姿勢
- 自ら模範を示す具体的行動
- メンバーの信頼を得る具体的アプローチ`);
    }

    if (targetScores.collaboration >= 3.5) {
      guidance.push(`【連携で${targetScores.collaboration}点を達成するには】
- 上司、関係部門、メンバーとの連携方法を具体的に記述
- 「〜と相談」「〜に協力依頼」「〜と情報共有」など具体的アクション
- 利害関係の調整方法を明示
- 部門を超えた連携視点`);
    }

    if (targetScores.development >= 3.5) {
      guidance.push(`【育成で${targetScores.development}点を達成するには】
- 「私がメンバーを育成する責任がある」という認識
- 個々のメンバーの強み・弱み・成長ニーズを把握
- 具体的育成計画（OJT、面談、研修など）
- 期待と現状のギャップを踏まえた段階的アプローチ`);
    }

    return guidance.length > 0
      ? `\n## 高スコア達成のための必須要件\n${guidance.join('\n\n')}\n`
      : '';
  };

  // 性格特徴（エゴグラム）に基づく文体指示を生成
  const generatePersonalityGuidance = () => {
    if (!personalityTraits) return '';

    const traits: string[] = [];

    if (personalityTraits.cp) {
      traits.push(`【CP（批判的な親）の特徴を反映】
- 規律を重視し、「〜すべきである」「〜してはならない」という断定的・指示的な表現を使う
- 正義感を持ち、問題に対して厳格な姿勢で臨む
- 責任の所在を明確にし、ルールや基準を重視する
- 妥協を許さない毅然とした態度を示す`);
    }

    if (personalityTraits.np) {
      traits.push(`【NP（養育的な親）の特徴を反映】
- 思いやりを持ち、「〜を支援する」「〜をサポートする」という支援的な表現を使う
- メンバーの気持ちに寄り添い、心理的安全性を重視する
- 「一緒に〜しよう」「〜してあげる」という協力的・保護的な姿勢
- 部下や同僚の成長を温かく見守る表現を含める`);
    }

    if (personalityTraits.a) {
      traits.push(`【A（大人）の特徴を反映】
- 論理的・客観的に分析し、感情的な表現を避ける
- データや事実に基づいた冷静な判断を示す
- 「〜と考えられる」「〜の観点から」という分析的な表現を使う
- 因果関係を明確にし、合理的な結論を導く`);
    }

    if (personalityTraits.fc) {
      traits.push(`【FC（自由な子供）の特徴を反映】
- 創造的・革新的なアイデアを積極的に提案する
- 「〜したい」「〜に挑戦する」という意欲的・前向きな表現を使う
- 既成概念にとらわれない柔軟な発想を示す
- 好奇心や情熱を感じさせる表現を含める`);
    }

    if (personalityTraits.ac) {
      traits.push(`【AC（順応した子供）の特徴を反映】
- 協調性を重視し、「〜かもしれない」「〜と思われる」という控えめな表現を使う
- 周囲の意見を尊重し、合意形成を大切にする姿勢
- 「〜についてご相談させていただく」という謙虚な態度
- 対立を避け、調和を重視した表現を含める`);
    }

    return traits.length > 0
      ? `\n## 文体の性格特徴（エゴグラム）
以下の性格特徴を解答の文体に反映させてください。複数選択されている場合は、それらをバランスよく組み合わせてください。

${traits.join('\n\n')}
`
      : '';
  };

  const prompt = `あなたは職場改善のスコア評価に精通した専門家です。

以下のシチュエーションについて、指定された目標スコアに相当する解答を生成してください。
参考として「類似解答者」の実際の解答を提示しますが、**目標スコアが類似解答者より高い場合は、類似解答者を超えるレベルの解答を生成してください。**

## シチュエーション
${situationText || '（シチュエーション情報なし）'}

## 目標スコア
- 問題把握: ${targetScores.problem}（満点5.0）
- 対策立案: ${targetScores.solution}（満点5.0）
- 役割理解: ${targetScores.role}（※主導・連携・育成の平均として自動計算）
- 主導: ${targetScores.leadership}（満点4.0）
- 連携: ${targetScores.collaboration}（満点4.0）
- 育成: ${targetScores.development}（満点4.0）
${generateHighScoreGuidance()}${generatePersonalityGuidance()}## 類似解答者の実際の解答（参考）
※類似解答者のスコアが目標より低い場合は、これを超えるレベルの解答を生成すること
${formatSimilarExamples()}

## 解答生成の指示（重要）

### 文体・表現ルール（厳守）
- **丁寧語（〜です・〜ます）は絶対に使用しない。常体で記述する**
- **一文一文は簡潔に。ただし全体の文量はしっかり確保する**（短文を積み重ねて十分な分量にする）
- **解答冒頭に宣言文は絶対に入れない**（「私がまず行うことは〜」「私はまず〜」「設問1の問題は〜」などは禁止）
- **解答の1文目から具体的な内容を書き始める**
- **文頭の接続詞は使用しない**（「まず」「次に」「そのため」「したがって」などは禁止）
- 構成を説明するような表現は避ける

### 評価項目の表記禁止（厳守）★重要★
- **解答テキスト内に評価項目名（問題把握、対策立案、役割理解、主導、連携、育成）を含めない**
- **「**...:**」「【...】」「（主導・育成）」のような評価項目ラベルは絶対に使用しない**
- 評価項目は採点の観点であり、解答テキストには一切含めてはならない
- NG例: 「**メンバー育成とコミュニケーション改善（育成・主導）:**」
- NG例: 「【連携】上司と相談する」
- OK例: 「メンバー育成とコミュニケーション改善を図る」（評価項目ラベルなし）

### 分量の目安（重要）★必ず守ること★
- 設問1: 400〜600文字程度（問題の構造と影響を説明できる分量）
- 設問2: 400〜600文字程度（具体的なアクションと関係者への働きかけを記述）
- 短すぎる解答は不可。学習データの高得点解答を参考に、十分な詳細さで記述する
- 具体性を重視し、抽象的な記述にならないようにする

### 設問1（問題把握）の解答
- 問題を単に箇条書きで列挙するのではなく、問題の構造・関連性・根本原因を分析的に記述する
- 「〜が問題である」だけでなく「なぜそれが問題なのか」「どのような影響があるのか」まで踏み込む
- 業務面の問題と人（心情・モチベーション）の問題の両方を含める

### 設問2（対策立案・主導・連携・育成）の解答
- 解答内で「私は〜する」「私が〜」という一人称表現を使用する（これが役割理解・主導の評価に直結）
- ただし、解答の冒頭は内容から直接書き始め、「私がまず行うことは〜」のような宣言文は避ける
- 抽象的な方針ではなく、具体的なアクション（誰に、何を、いつ、どのように）を示す
- 上司・関係部門・メンバーそれぞれへの働きかけを具体的に記述する（連携の評価）
- メンバー育成の具体的な計画を含める（育成の評価）

## 出力形式
以下のJSON形式で出力してください。

\`\`\`json
{
  "q1Answer": "設問1への予測解答（問題の分析と構造化、400〜600文字程度）",
  "q1Reason": "設問1の解答の理由（箇条書き3点まで）",
  "q2Answer": "設問2への予測解答（一人称を使用、冒頭は内容から直接開始、400〜600文字程度）",
  "q2Reason": "設問2の解答の理由（箇条書き3点まで）"
}
\`\`\``;

  // Gemini API呼び出し
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY（または GOOGLE_API_KEY）が設定されていません。環境変数を確認してください。');
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 60000; // 60秒（本番環境で遅延があるため）
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      // セキュリティ: 内部エラー詳細はログのみ、APIキーやURLは本番ログに出力しない
      if (process.env.NODE_ENV === 'development') {
        const errorText = await response.text();
        console.error('[Gemini API] Error Status:', response.status);
        console.error('[Gemini API] Error Response:', errorText.slice(0, 200));
      } else {
        console.error('[Gemini API] Error Status:', response.status);
      }
      throw new Error('予測APIでエラーが発生しました');
    }

    const data = await response.json();

    // Safetyブロックやcandidates空のケースをチェック
    if (data.promptFeedback?.blockReason) {
      console.error('[generatePredictionFromSimilar] Prompt blocked by safety filter:', data.promptFeedback.blockReason);
      throw new Error(`Gemini APIがプロンプトをブロックしました: ${data.promptFeedback.blockReason}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error('[generatePredictionFromSimilar] No candidates returned from Gemini API');
      console.error('[generatePredictionFromSimilar] Full response:', JSON.stringify(data).substring(0, 500));
      throw new Error('Gemini APIからの応答がありませんでした。Safetyフィルターでブロックされた可能性があります。');
    }

    // finish_reasonをチェック（MAX_TOKENSの場合は出力が切り詰められている）
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      console.error('[generatePredictionFromSimilar] Response blocked by safety filter');
      throw new Error('Gemini APIの応答がSafetyフィルターでブロックされました。');
    }
    if (finishReason && finishReason !== 'STOP') {
      console.warn('[generatePredictionFromSimilar] finishReason:', finishReason, '- 出力が途中で切れている可能性があります');
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 空レスポンスのチェック
    if (!generatedText) {
      console.error('[generatePredictionFromSimilar] Empty text from Gemini API');
      console.error('[generatePredictionFromSimilar] Candidate:', JSON.stringify(data.candidates[0]).substring(0, 500));
      throw new Error('Gemini APIからのテキスト応答が空でした。');
    }

    // JSONを抽出してパース（複数パターン対応）
    const parsedResult = extractAndParseJson(generatedText);
    if (parsedResult) {
      // 評価項目パターンをサニタイズ
      return {
        q1Answer: sanitizeAnswerText(parsedResult.q1Answer || '') || '予測解答を生成できませんでした',
        q1Reason: parsedResult.q1Reason || undefined,
        q2Answer: sanitizeAnswerText(parsedResult.q2Answer || '') || '予測解答を生成できませんでした',
        q2Reason: parsedResult.q2Reason || undefined,
      };
    }

    // パース失敗時はエラーログを出力（本番でも内容を出力して原因特定）
    console.error('[generatePredictionFromSimilar] JSON parse failed. Raw text (first 500 chars):', generatedText.substring(0, 500));
    throw new Error('予測解答の生成に失敗しました。AIの応答を解析できませんでした。');
  } catch (error) {
    console.error('generatePredictionFromSimilar error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('予測解答の生成中にエラーが発生しました。');
  }
}

// 他のケースの解答を「形式・口調のみ」参考にして予測解答を生成（データ0件時のフォールバック用）
// 内容は反映せず、スコアに基づいてAIが生成
export async function generatePredictionWithStyleReference(
  situationText: string,
  styleReferenceResponses: { answer_q1: string | null; answer_q2: string | null; answer_q3?: string | null; answer_q4?: string | null; answer_q5?: string | null; answer_q6?: string | null; answer_q7?: string | null; answer_q8?: string | null; score_problem: number | null; score_solution: number | null; score_role: number | null; score_leadership: number | null; score_collaboration: number | null; score_development: number | null }[],
  targetScores: Scores,
  personalityTraits?: PersonalityTraits
): Promise<PredictionResponse> {
  // 参考解答のフォーマット（内容ではなく形式・口調の例として）
  const formatStyleExamples = () => {
    if (!styleReferenceResponses.length) return '（参考例なし）';
    return styleReferenceResponses.slice(0, 3).map((r, i) => {
      return `【参考例${i + 1}】
設問1の解答例: ${r.answer_q1 || '（なし）'}
設問2の解答例: ${combineQ2Answers(r)}`;
    }).join('\n\n');
  };

  // 目標スコアが高い場合の追加指示
  const generateHighScoreGuidance = () => {
    const guidance: string[] = [];

    if (targetScores.problem >= 3.5) {
      guidance.push(`【問題把握で${targetScores.problem}点を達成するには】
- 問題間の関連性や因果関係を分析（単なる列挙は不可）
- 根本原因（なぜこの問題が起きているか）を明示
- 業務面と人（心情・モチベーション）の両面から問題を捉える
- 維持管理と改革の両視点を含める
- 優先順位を明確に示す`);
    }

    if (targetScores.solution >= 3.5) {
      guidance.push(`【対策立案で${targetScores.solution}点を達成するには】
- 具体的アクションステップ（誰が、何を、いつ、どのように）を明示
- 短期・中期・長期の対策を整理
- 優先順位と実施スケジュールを示す
- リスクと対応策を含める`);
    }

    if (targetScores.role >= 3.5) {
      guidance.push(`【役割理解で${targetScores.role}点を達成するには】★重要★
※役割理解 = (主導 + 連携 + 育成) ÷ 3 で計算
- 解答内で「私は〜する」「私が〜」という一人称表現を適宜使用（ただし冒頭からではなく内容の中で）
- 組織における自分の立場と責任を明示
- 上司への報告・相談、部下への指示・支援、関係部門との調整を具体的に記述
- 「〜すべき」ではなく「私が〜を実行する」という当事者意識`);
    }

    if (targetScores.leadership >= 3.5) {
      guidance.push(`【主導で${targetScores.leadership}点を達成するには】
- 解答内で「私が率先して〜」「私が先頭に立って〜」という表現を使用
- 困難でも最後までやり遂げる姿勢
- 自ら模範を示す具体的行動
- メンバーの信頼を得る具体的アプローチ`);
    }

    if (targetScores.collaboration >= 3.5) {
      guidance.push(`【連携で${targetScores.collaboration}点を達成するには】
- 上司、関係部門、メンバーとの連携方法を具体的に記述
- 「〜と相談」「〜に協力依頼」「〜と情報共有」など具体的アクション
- 利害関係の調整方法を明示
- 部門を超えた連携視点`);
    }

    if (targetScores.development >= 3.5) {
      guidance.push(`【育成で${targetScores.development}点を達成するには】
- 「私がメンバーを育成する責任がある」という認識
- 個々のメンバーの強み・弱み・成長ニーズを把握
- 具体的育成計画（OJT、面談、研修など）
- 期待と現状のギャップを踏まえた段階的アプローチ`);
    }

    return guidance.length > 0
      ? `\n## 高スコア達成のための必須要件\n${guidance.join('\n\n')}\n`
      : '';
  };

  // 性格特徴（エゴグラム）に基づく文体指示を生成
  const generatePersonalityGuidance = () => {
    if (!personalityTraits) return '';

    const traits: string[] = [];

    if (personalityTraits.cp) {
      traits.push(`【CP（批判的な親）の特徴を反映】
- 規律を重視し、「〜すべきである」「〜してはならない」という断定的・指示的な表現を使う
- 正義感を持ち、問題に対して厳格な姿勢で臨む`);
    }

    if (personalityTraits.np) {
      traits.push(`【NP（養育的な親）の特徴を反映】
- 思いやりを持ち、「〜を支援する」「〜をサポートする」という支援的な表現を使う
- メンバーの気持ちに寄り添い、心理的安全性を重視する`);
    }

    if (personalityTraits.a) {
      traits.push(`【A（大人）の特徴を反映】
- 論理的・客観的に分析し、感情的な表現を避ける
- データや事実に基づいた冷静な判断を示す`);
    }

    if (personalityTraits.fc) {
      traits.push(`【FC（自由な子供）の特徴を反映】
- 創造的・革新的なアイデアを積極的に提案する
- 「〜したい」「〜に挑戦する」という意欲的・前向きな表現を使う`);
    }

    if (personalityTraits.ac) {
      traits.push(`【AC（順応した子供）の特徴を反映】
- 協調性を重視し、「〜かもしれない」「〜と思われる」という控えめな表現を使う
- 周囲の意見を尊重し、合意形成を大切にする姿勢`);
    }

    return traits.length > 0
      ? `\n## 文体の性格特徴（エゴグラム）\n${traits.join('\n\n')}\n`
      : '';
  };

  const prompt = `あなたは職場改善のスコア評価に精通した専門家です。

以下のシチュエーションについて、指定された目標スコアに相当する解答を生成してください。

**重要**: 参考例として示す解答は「文体・形式・口調・長さ」の参考のみに使用してください。
参考例の**内容は一切反映しないでください**。シチュエーションと目標スコアに基づいて独自の解答を生成すること。

## シチュエーション
${situationText || '（シチュエーション情報なし）'}

## 目標スコア
- 問題把握: ${targetScores.problem}（満点5.0）
- 対策立案: ${targetScores.solution}（満点5.0）
- 役割理解: ${targetScores.role}（※主導・連携・育成の平均として自動計算）
- 主導: ${targetScores.leadership}（満点4.0）
- 連携: ${targetScores.collaboration}（満点4.0）
- 育成: ${targetScores.development}（満点4.0）
${generateHighScoreGuidance()}${generatePersonalityGuidance()}## 文体・形式の参考例（※内容は参考にしない！形式のみ参考）
以下は他のケースの解答例です。**内容は参考にせず、文体・形式・口調・長さの参考のみ**として使用してください。
${formatStyleExamples()}

## 解答生成の指示（重要）

### 文体・表現ルール（厳守）
- **丁寧語（〜です・〜ます）は絶対に使用しない。常体で記述する**
- **一文一文は簡潔に。ただし全体の文量はしっかり確保する**（短文を積み重ねて十分な分量にする）
- **解答冒頭に宣言文は絶対に入れない**（「私がまず行うことは〜」「私はまず〜」「設問1の問題は〜」などは禁止）
- **解答の1文目から具体的な内容を書き始める**
- **文頭の接続詞は使用しない**（「まず」「次に」「そのため」「したがって」などは禁止）

### 評価項目の表記禁止（厳守）★重要★
- **解答テキスト内に評価項目名（問題把握、対策立案、役割理解、主導、連携、育成）を含めない**
- **「**...:**」「【...】」「（主導・育成）」のような評価項目ラベルは絶対に使用しない**
- 評価項目は採点の観点であり、解答テキストには一切含めてはならない
- NG例: 「**メンバー育成とコミュニケーション改善（育成・主導）:**」
- OK例: 「メンバー育成とコミュニケーション改善を図る」（評価項目ラベルなし）

### 分量の目安（重要）★必ず守ること★
- 設問1: 400〜600文字程度（問題の構造と影響を説明できる分量）
- 設問2: 400〜600文字程度（具体的なアクションと関係者への働きかけを記述）
- 短すぎる解答は不可。参考例の文体・長さを参考に、十分な詳細さで記述する
- 具体性を重視し、抽象的な記述にならないようにする

### 設問1（問題把握）の解答
- 問題の構造・関連性・根本原因を分析的に記述する
- 「なぜそれが問題なのか」「どのような影響があるのか」まで踏み込む
- 業務面と人の問題の両方を含める

### 設問2（対策立案・主導・連携・育成）の解答
- 解答内で「私は〜する」「私が〜」という一人称表現を使用する（これが役割理解・主導の評価に直結）
- ただし、解答の冒頭は内容から直接書き始め、「私がまず行うことは〜」のような宣言文は避ける
- 具体的なアクション（誰に、何を、いつ、どのように）を示す
- 上司・関係部門・メンバーそれぞれへの働きかけを記述

## 出力形式
以下のJSON形式で出力してください。

\`\`\`json
{
  "q1Answer": "設問1への予測解答（問題の分析と構造化、400〜600文字程度）",
  "q1Reason": "設問1の解答の理由（箇条書き3点まで）",
  "q2Answer": "設問2への予測解答（一人称を使用、冒頭は内容から直接開始、400〜600文字程度）",
  "q2Reason": "設問2の解答の理由（箇条書き3点まで）"
}
\`\`\``;

  // Gemini API呼び出し
  if (!GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY（または GOOGLE_API_KEY）が設定されていません。環境変数を確認してください。');
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 60000; // 60秒
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      // セキュリティ: 内部エラー詳細はログのみ、APIキーやURLは本番ログに出力しない
      if (process.env.NODE_ENV === 'development') {
        const errorText = await response.text();
        console.error('[Gemini API] Error Status:', response.status);
        console.error('[Gemini API] Error Response:', errorText.slice(0, 200));
      } else {
        console.error('[Gemini API] Error Status:', response.status);
      }
      throw new Error('予測APIでエラーが発生しました');
    }

    const data = await response.json();

    // Safetyブロックやcandidates空のケースをチェック
    if (data.promptFeedback?.blockReason) {
      console.error('[generatePredictionWithStyleReference] Prompt blocked by safety filter:', data.promptFeedback.blockReason);
      throw new Error(`Gemini APIがプロンプトをブロックしました: ${data.promptFeedback.blockReason}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.error('[generatePredictionWithStyleReference] No candidates returned from Gemini API');
      console.error('[generatePredictionWithStyleReference] Full response:', JSON.stringify(data).substring(0, 500));
      throw new Error('Gemini APIからの応答がありませんでした。Safetyフィルターでブロックされた可能性があります。');
    }

    // finish_reasonをチェック（MAX_TOKENSの場合は出力が切り詰められている）
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason === 'SAFETY') {
      console.error('[generatePredictionWithStyleReference] Response blocked by safety filter');
      throw new Error('Gemini APIの応答がSafetyフィルターでブロックされました。');
    }
    if (finishReason && finishReason !== 'STOP') {
      console.warn('[generatePredictionWithStyleReference] finishReason:', finishReason, '- 出力が途中で切れている可能性があります');
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // 空レスポンスのチェック
    if (!generatedText) {
      console.error('[generatePredictionWithStyleReference] Empty text from Gemini API');
      console.error('[generatePredictionWithStyleReference] Candidate:', JSON.stringify(data.candidates[0]).substring(0, 500));
      throw new Error('Gemini APIからのテキスト応答が空でした。');
    }

    // JSONを抽出してパース（複数パターン対応）
    const parsedResult = extractAndParseJson(generatedText);
    if (parsedResult) {
      // 評価項目パターンをサニタイズ
      return {
        q1Answer: sanitizeAnswerText(parsedResult.q1Answer || '') || '予測解答を生成できませんでした',
        q1Reason: parsedResult.q1Reason || undefined,
        q2Answer: sanitizeAnswerText(parsedResult.q2Answer || '') || '予測解答を生成できませんでした',
        q2Reason: parsedResult.q2Reason || undefined,
      };
    }

    // パース失敗時はエラーログを出力（generatedTextの先頭を出力）
    console.error('[generatePredictionWithStyleReference] JSON parse failed. Raw text:', generatedText.substring(0, 500));
    throw new Error('予測解答の生成に失敗しました。AIの応答を解析できませんでした。');
  } catch (error) {
    console.error('generatePredictionWithStyleReference error:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('予測解答の生成中にエラーが発生しました。');
  }
}

// 生成された解答テキストから評価項目パターンを削除するサニタイズ関数
// 例: "**メンバー育成とコミュニケーション改善（育成・主導）:**" → "メンバー育成とコミュニケーション改善"
// テスト用にexport
export function sanitizeAnswerText(text: string): string {
  if (!text) return text;

  let sanitized = text;

  // パターン1: **...（評価項目）:** 形式を削除
  // 例: "**メンバー育成とコミュニケーション改善（育成・主導）:**" → "メンバー育成とコミュニケーション改善"
  sanitized = sanitized.replace(/\*\*([^*]+?)（[^）]*(?:問題把握|対策立案|役割理解|主導|連携|育成)[^）]*）\**:\**/g, '$1');

  // パターン2: **...:** 形式で評価項目を含むもの（括弧なし）
  // 例: "**主導:** 私が率先して" → "私が率先して"
  sanitized = sanitized.replace(/\*\*(?:問題把握|対策立案|役割理解|主導|連携|育成)[^:]*:\*\*/g, '');

  // パターン3: 【...】形式の評価項目ラベル
  // 例: "【主導で3.5点を達成するには】" → ""
  sanitized = sanitized.replace(/【[^】]*(?:問題把握|対策立案|役割理解|主導|連携|育成)[^】]*】/g, '');

  // パターン4: 行頭の "- " の後の評価項目ラベル
  // 例: "- 問題把握: ..." → "- ..."
  sanitized = sanitized.replace(/^(- )(?:問題把握|対策立案|役割理解|主導|連携|育成)[:：]\s*/gm, '$1');

  // パターン5: 単独の評価項目ラベル行を削除
  // 例: "問題把握:" のみの行
  sanitized = sanitized.replace(/^(?:問題把握|対策立案|役割理解|主導|連携|育成)[:：]?\s*$/gm, '');

  // パターン6: 文中の（評価項目）表記を削除
  // 例: "改善を行う（主導・育成）。" → "改善を行う。"
  sanitized = sanitized.replace(/（[^）]*(?:問題把握|対策立案|役割理解|主導|連携|育成)[^）]*）/g, '');

  // 連続する空行を1つに
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');

  // 先頭・末尾の空白行を削除
  sanitized = sanitized.trim();

  return sanitized;
}

// 自由形式のマネジメント相談に解答（エンベディングなし）
export async function generateFreeFormAnswer(
  question: string,
  targetScores: Scores,
  personalityTraits?: PersonalityTraits
): Promise<{ answer: string; reasoning?: string; suggestions?: string[] }> {
  // スコアレベルに基づくアドバイスの深さを調整
  const getScoreLevelGuidance = () => {
    const avgScore = (targetScores.problem + targetScores.solution + targetScores.leadership + targetScores.collaboration + targetScores.development) / 5;

    if (avgScore >= 3.5) {
      return `解答レベル: 高度（スコア${avgScore.toFixed(1)}）- 戦略的視点、組織全体への影響を考慮`;
    } else if (avgScore >= 2.5) {
      return `解答レベル: 標準（スコア${avgScore.toFixed(1)}）- 実践的で具体的なアドバイス`;
    } else {
      return `解答レベル: 基礎（スコア${avgScore.toFixed(1)}）- 基本的で分かりやすいアドバイス`;
    }
  };

  const prompt = `あなたはマネジメントの専門家です。管理職の相談に対して、端的かつ具体的に解答してください。

## 相談内容
${question}

## 相談者のマネジメント能力
- 問題把握: ${targetScores.problem}/5.0
- 対策立案: ${targetScores.solution}/5.0
- 主導: ${targetScores.leadership}/4.0
- 連携: ${targetScores.collaboration}/4.0
- 育成: ${targetScores.development}/4.0
- ${getScoreLevelGuidance()}

## 解答ルール（厳守）
- 同情や共感の言葉は一切不要（「お疲れ様です」「辛いですよね」等は禁止）
- 前置きなしで、すぐに具体的な対応策を述べる
- 箇条書きで端的に解答する
- 各項目は1-2文で簡潔に
- 実行可能な具体的アクションを示す

## 出力形式
以下のJSON形式で出力してください。answerのみ記載すること。

\`\`\`json
{
  "answer": "箇条書きで端的な解答（各項目1-2文、全体で300-500文字程度）"
}
\`\`\``;

  // Gemini API呼び出し
  console.log('[generateFreeFormAnswer] ===== DEBUG INFO =====');
  console.log('[generateFreeFormAnswer] GEMINI_API_URL:', GEMINI_API_URL);
  console.log('[generateFreeFormAnswer] GEMINI_API_KEY exists:', !!GEMINI_API_KEY);
  console.log('[generateFreeFormAnswer] GEMINI_API_KEY prefix:', GEMINI_API_KEY?.substring(0, 10) + '...');

  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. Returning mock response.');
    return {
      answer: '（APIキー未設定のためモック解答）ご相談の内容について、まずは現状の把握と関係者との対話を通じて、具体的な改善策を見出していくことをお勧めします。',
      reasoning: 'モック解答のため根拠はありません。',
      suggestions: ['関係者との1on1面談を実施する', 'チームの状況を可視化する', '小さな成功体験を積み重ねる'],
    };
  }

  try {
    const apiUrl = `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`;
    console.log('[generateFreeFormAnswer] Full API URL (without key):', GEMINI_API_URL);

    const controller = new AbortController();
    const timeoutMs = 60000; // 60秒
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 8192,
        },
      }),
    });
    clearTimeout(timer);

    if (!response.ok) {
      // セキュリティ: 内部エラー詳細はログのみ、APIキーやURLは本番ログに出力しない
      if (process.env.NODE_ENV === 'development') {
        const errorText = await response.text();
        console.error('[Gemini API] Error Status:', response.status);
        console.error('[Gemini API] Error Response:', errorText.slice(0, 200));
      } else {
        console.error('[Gemini API] Error Status:', response.status);
      }
      throw new Error('予測APIでエラーが発生しました');
    }

    const data = await response.json();

    // finish_reasonをチェック（MAX_TOKENSの場合は出力が切り詰められている）
    const finishReason = data.candidates?.[0]?.finishReason;
    if (finishReason && finishReason !== 'STOP') {
      console.warn('[generateFreeFormAnswer] finishReason:', finishReason, '- 出力が途中で切れている可能性があります');
    }

    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // JSONを抽出してパース
    const jsonMatch = generatedText.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[1]);
      return {
        answer: parsed.answer || '解答を生成できませんでした',
        reasoning: parsed.reasoning || undefined,
        suggestions: parsed.suggestions || undefined,
      };
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return {
        answer: parsed.answer || '解答を生成できませんでした',
        reasoning: parsed.reasoning || undefined,
        suggestions: parsed.suggestions || undefined,
      };
    } catch {
      return {
        answer: generatedText.substring(0, 1000),
        reasoning: undefined,
        suggestions: undefined,
      };
    }
  } catch (error) {
    console.error('generateFreeFormAnswer error:', error);
    return {
      answer: 'エラーが発生しました。時間をおいて再度お試しください。',
      reasoning: undefined,
      suggestions: undefined,
    };
  }
}

