// Google Gemini API クライアント
// LLMによる回答生成（RAG: Retrieval-Augmented Generation）
// PE-01: 予測応答時間5秒以内を目標

import type { PredictionResponse, Scores } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

export type FewShotContext = {
  problemScoreBucket: number;
  solutionScoreBucket: number;
  problemExamples: string[];
  solutionExamples: string[];
};

// few-shot典型例を参考にLLMで新たな回答を生成
export async function generatePrediction(
  situationText: string,
  fewShot: FewShotContext,
  targetScores: Scores
): Promise<PredictionResponse> {
  const formatExamples = (title: string, examples: string[]) => {
    if (!examples.length) return `${title}\n（例が見つかりませんでした）`;
    return `${title}\n${examples.map((t, i) => `【例${i + 1}】\n${t}`).join('\n\n')}`;
  };

  const prompt = `あなたは職場改善のスコア評価に精通した専門家です。

以下のシチュエーションについて、指定された目標スコアに相当する回答を生成してください。
参考として、目標スコア帯の「典型的な回答（重心近傍）」をfew-shot例として提示します。

## シチュエーション
${situationText || '（シチュエーション情報なし）'}

## 目標スコア
- 問題把握: ${targetScores.problem}
- 対策立案: ${targetScores.solution}
- 役割理解: ${targetScores.role}
- 主導: ${targetScores.leadership}
- 連携: ${targetScores.collaboration}
- 育成: ${targetScores.development}

## few-shot（典型例）
${formatExamples(`以下は「問題把握 ${fewShot.problemScoreBucket}点帯」の典型的な回答です。`, fewShot.problemExamples)}

${formatExamples(`以下は「対策立案 ${fewShot.solutionScoreBucket}点帯」の典型的な回答です。`, fewShot.solutionExamples)}

## 指示（重要）
上記の典型例と**同じ意味空間**（同じ観点・粒度・具体性・構造）に沿って、目標スコアを達成しうる回答を生成してください。

## 指示
上記の目標スコアを持つ人物が書きそうな回答を、以下のJSON形式で出力してください。
回答は具体的で、スコアレベルに見合った内容にしてください。
さらに、なぜその回答になるのかを「理由」として簡潔に説明してください。

\`\`\`json
{
  "q1Answer": "設問1についての予測回答（200文字程度）",
  "q1Reason": "設問1の回答の理由（箇条書き3点まで）",
  "q2Answer": "設問2についての予測回答（200文字程度）",
  "q2Reason": "設問2の回答の理由（箇条書き3点まで）"
}
\`\`\``;

  // Gemini API呼び出し
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. Returning mock response.');
    return generateMockPrediction(targetScores);
  }

  try {
    // PE-01: 予測応答時間（5秒以内）を意識し、LLM呼び出しはタイムアウトを設ける
    const controller = new AbortController();
    const timeoutMs = 3500;
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
          // 出力を抑えて応答を速くする
          maxOutputTokens: 512,
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
        q1Answer: parsed.q1Answer || '予測回答を生成できませんでした',
        q1Reason: parsed.q1Reason || undefined,
        q2Answer: parsed.q2Answer || '予測回答を生成できませんでした',
        q2Reason: parsed.q2Reason || undefined,
      };
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return {
        q1Answer: parsed.q1Answer || '予測回答を生成できませんでした',
        q1Reason: parsed.q1Reason || undefined,
        q2Answer: parsed.q2Answer || '予測回答を生成できませんでした',
        q2Reason: parsed.q2Reason || undefined,
      };
    } catch {
      // パースできない場合はテキストをそのまま使用
      return {
        q1Answer: generatedText.substring(0, 500),
        q2Answer: '（回答の分離に失敗しました）',
      };
    }
  } catch (error) {
    console.error('generatePrediction error:', error);
    // エラー時はモック回答を返す
    return generateMockPrediction(targetScores);
  }
}

// q2 用のテキスト結合ヘルパー
function combineQ2Answers(r: { answer_q2?: string | null; answer_q3?: string | null; answer_q4?: string | null; answer_q5?: string | null; answer_q6?: string | null; answer_q7?: string | null; answer_q8?: string | null }): string {
  return [r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8]
    .filter(Boolean)
    .join('\n') || '（なし）';
}

// 類似回答者の回答を参考にLLMで新たな回答を生成（ユークリッド距離ベース）
export async function generatePredictionFromSimilar(
  situationText: string,
  similarResponses: { answer_q1: string | null; answer_q2: string | null; answer_q3?: string | null; answer_q4?: string | null; answer_q5?: string | null; answer_q6?: string | null; answer_q7?: string | null; answer_q8?: string | null; score_problem: number | null; score_solution: number | null; score_role: number | null; score_leadership: number | null; score_collaboration: number | null; score_development: number | null }[],
  targetScores: Scores
): Promise<PredictionResponse> {
  // 類似回答者の回答をフォーマット
  const formatSimilarExamples = () => {
    if (!similarResponses.length) return '（類似回答者が見つかりませんでした）';
    return similarResponses.map((r, i) => {
      const scores = `[問題把握:${r.score_problem ?? '-'}, 対策立案:${r.score_solution ?? '-'}, 役割理解:${r.score_role ?? '-'}, 主導:${r.score_leadership ?? '-'}, 連携:${r.score_collaboration ?? '-'}, 育成:${r.score_development ?? '-'}]`;
      return `【類似回答者${i + 1}】${scores}
設問1の回答: ${r.answer_q1 || '（なし）'}
設問2の回答: ${combineQ2Answers(r)}`;
    }).join('\n\n');
  };

  const prompt = `あなたは職場改善のスコア評価に精通した専門家です。

以下のシチュエーションについて、指定された目標スコアに相当する回答を生成してください。
参考として、6指標のスコアが目標に近い「類似回答者」の実際の回答を提示します。
これらの回答者は目標スコアと似た特性（問題把握力、対策立案力、役割理解、主導力、連携力、育成力）を持つ人物です。

## シチュエーション
${situationText || '（シチュエーション情報なし）'}

## 目標スコア
- 問題把握: ${targetScores.problem}
- 対策立案: ${targetScores.solution}
- 役割理解: ${targetScores.role}
- 主導: ${targetScores.leadership}
- 連携: ${targetScores.collaboration}
- 育成: ${targetScores.development}

## 類似回答者の実際の回答（6指標が目標に近い人物）
${formatSimilarExamples()}

## 指示（重要）
上記の類似回答者の回答パターン（観点・粒度・具体性・文体）を参考に、目標スコアを達成しうる回答を生成してください。
類似回答者の回答の良い点を取り入れつつ、目標スコアのレベルに合った内容にしてください。

## 出力形式
以下のJSON形式で出力してください。

\`\`\`json
{
  "q1Answer": "設問1への予測回答（200文字程度）",
  "q1Reason": "設問1の回答の理由（箇条書き3点まで）",
  "q2Answer": "設問2への予測回答（200文字程度）",
  "q2Reason": "設問2の回答の理由（箇条書き3点まで）"
}
\`\`\``;

  // Gemini API呼び出し
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. Returning mock response.');
    return generateMockPrediction(targetScores);
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 15000; // 15秒に延長
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
          maxOutputTokens: 512,
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
        q1Answer: parsed.q1Answer || '予測回答を生成できませんでした',
        q1Reason: parsed.q1Reason || undefined,
        q2Answer: parsed.q2Answer || '予測回答を生成できませんでした',
        q2Reason: parsed.q2Reason || undefined,
      };
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return {
        q1Answer: parsed.q1Answer || '予測回答を生成できませんでした',
        q1Reason: parsed.q1Reason || undefined,
        q2Answer: parsed.q2Answer || '予測回答を生成できませんでした',
        q2Reason: parsed.q2Reason || undefined,
      };
    } catch {
      return {
        q1Answer: generatedText.substring(0, 500),
        q2Answer: '（回答の分離に失敗しました）',
      };
    }
  } catch (error) {
    console.error('generatePredictionFromSimilar error:', error);
    return generateMockPrediction(targetScores);
  }
}

// モック予測回答を生成（API未設定時やエラー時用）
function generateMockPrediction(
  targetScores: Scores
): PredictionResponse {
  const scoreLevel = (targetScores.problem + targetScores.solution) / 2;
  
  let q1Answer: string;
  let q2Answer: string;

  if (scoreLevel >= 3.5) {
    q1Answer = '現状の問題点を的確に把握し、根本原因を多角的な視点から分析しています。組織全体への影響を考慮した上で、優先順位を明確に設定できています。';
    q2Answer = '具体的かつ実現可能な対策を複数提案し、それぞれのメリット・デメリットを考慮した上で最適な解決策を選択できています。実施計画も明確です。';
  } else if (scoreLevel >= 2.5) {
    q1Answer = '主要な問題点は認識できており、ある程度の原因分析ができています。ただし、一部の視点が不足している可能性があります。';
    q2Answer = '基本的な対策は提案できていますが、より具体的な実施方法や想定されるリスクへの対応が求められます。';
  } else {
    q1Answer = '問題点の把握が表面的であり、より深い原因分析が必要です。関係者の視点からの検討も求められます。';
    q2Answer = '対策の提案はあるものの、具体性や実現可能性の検討が不足しています。より詳細な計画立案が望まれます。';
  }

  const q1Reason = '（モック）スコア水準に合わせて、問題の把握深度と根拠の示し方を調整しました。';
  const q2Reason = '（モック）実行可能性と具体性のバランスがスコア水準に合うように調整しました。';

  return {
    q1Answer,
    q1Reason,
    q2Answer,
    q2Reason,
  };
}
