// Google Gemini API クライアント
// LLMによる回答生成（RAG: Retrieval-Augmented Generation）
// PE-01: 予測応答時間5秒以内を目標

import type { Response, PredictionResponse, Scores } from '@/types';

const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// 類似回答を参考にLLMで新たな回答を生成
export async function generatePrediction(
  situationText: string,
  similarResponses: Response[],
  targetScores: Scores
): Promise<PredictionResponse> {
  // 参考回答をコンテキストとして構築
  const referenceAnswers = similarResponses
    .map((r, i) => {
      const scores = `スコア - 問題把握: ${r.score_problem}, 対策立案: ${r.score_solution}, 役割理解: ${r.score_role}`;
      const problemAnswer = r.answer_q1 || r.comment_problem || '（回答なし）';
      const solutionAnswer = r.answer_q2 || r.comment_solution || '（回答なし）';
      return `【参考回答${i + 1}】\n${scores}\n問題把握の回答: ${problemAnswer}\n対策立案の回答: ${solutionAnswer}`;
    })
    .join('\n\n---\n\n');

  const prompt = `あなたは職場改善のスコア評価に精通した専門家です。

以下のシチュエーションについて、指定された目標スコアに相当する回答を生成してください。
参考として、類似スコアを持つ過去の回答者の回答を提示します。

## シチュエーション
${situationText || '（シチュエーション情報なし）'}

## 目標スコア
- 問題把握: ${targetScores.problem}
- 対策立案: ${targetScores.solution}
- 役割理解: ${targetScores.role}
- 主導: ${targetScores.leadership}
- 連携: ${targetScores.collaboration}
- 育成: ${targetScores.development}

## 参考となる過去の回答
${referenceAnswers}

## 指示
上記の目標スコアを持つ人物が書きそうな回答を、以下のJSON形式で出力してください。
回答は具体的で、スコアレベルに見合った内容にしてください。
さらに、なぜその回答になるのかを「理由」として簡潔に説明してください。

\`\`\`json
{
  "problemAnswer": "問題把握についての予測回答（200文字程度）",
  "problemReason": "問題把握の回答の理由（箇条書き3点まで）",
  "solutionAnswer": "対策立案についての予測回答（200文字程度）",
  "solutionReason": "対策立案の回答の理由（箇条書き3点まで）"
}
\`\`\``;

  // Gemini API呼び出し
  if (!GEMINI_API_KEY) {
    console.warn('GOOGLE_API_KEY is not set. Returning mock response.');
    return generateMockPrediction(targetScores, similarResponses);
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
        problemAnswer: parsed.problemAnswer || '予測回答を生成できませんでした',
        problemReason: parsed.problemReason || undefined,
        solutionAnswer: parsed.solutionAnswer || '予測回答を生成できませんでした',
        solutionReason: parsed.solutionReason || undefined,
      };
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return {
        problemAnswer: parsed.problemAnswer || '予測回答を生成できませんでした',
        problemReason: parsed.problemReason || undefined,
        solutionAnswer: parsed.solutionAnswer || '予測回答を生成できませんでした',
        solutionReason: parsed.solutionReason || undefined,
      };
    } catch {
      // パースできない場合はテキストをそのまま使用
      return {
        problemAnswer: generatedText.substring(0, 500),
        solutionAnswer: '（回答の分離に失敗しました）',
      };
    }
  } catch (error) {
    console.error('generatePrediction error:', error);
    // エラー時はモック回答を返す
    return generateMockPrediction(targetScores, similarResponses);
  }
}

// モック予測回答を生成（API未設定時やエラー時用）
function generateMockPrediction(
  targetScores: Scores,
  similarResponses: Response[]
): PredictionResponse {
  const scoreLevel = (targetScores.problem + targetScores.solution) / 2;
  
  let problemAnswer: string;
  let solutionAnswer: string;

  if (scoreLevel >= 3.5) {
    problemAnswer = '現状の問題点を的確に把握し、根本原因を多角的な視点から分析しています。組織全体への影響を考慮した上で、優先順位を明確に設定できています。';
    solutionAnswer = '具体的かつ実現可能な対策を複数提案し、それぞれのメリット・デメリットを考慮した上で最適な解決策を選択できています。実施計画も明確です。';
  } else if (scoreLevel >= 2.5) {
    problemAnswer = '主要な問題点は認識できており、ある程度の原因分析ができています。ただし、一部の視点が不足している可能性があります。';
    solutionAnswer = '基本的な対策は提案できていますが、より具体的な実施方法や想定されるリスクへの対応が求められます。';
  } else {
    problemAnswer = '問題点の把握が表面的であり、より深い原因分析が必要です。関係者の視点からの検討も求められます。';
    solutionAnswer = '対策の提案はあるものの、具体性や実現可能性の検討が不足しています。より詳細な計画立案が望まれます。';
  }

  // 類似回答があれば、その情報も活用
  if (similarResponses.length > 0 && similarResponses[0].answer_q1) {
    problemAnswer = `${problemAnswer}\n\n【参考】類似スコアの回答者の傾向: ${similarResponses[0].answer_q1.substring(0, 100)}...`;
  }

  return {
    problemAnswer,
    problemReason: '（モック）スコア水準に合わせて、問題の把握深度と根拠の示し方を調整しました。',
    solutionAnswer,
    solutionReason: '（モック）実行可能性と具体性のバランスがスコア水準に合うように調整しました。',
  };
}
