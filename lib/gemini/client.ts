// Google Gemini API クライアント
// LLMによる回答生成（RAG: Retrieval-Augmented Generation）
// PE-01: 予測応答時間5秒以内を目標

import type { PredictionResponse, Scores } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

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

  // 目標スコアが高い場合（3.5以上）の追加指示を生成
  const generateHighScoreGuidance = () => {
    const guidance: string[] = [];

    if (targetScores.problem >= 3.5) {
      guidance.push(`【問題把握で${targetScores.problem}点を達成するには】
- 問題を単に列挙するのではなく、問題間の関連性や因果関係を分析する
- 表面的な症状だけでなく、根本原因（なぜこの問題が起きているのか）を明確に示す
- 業務面と人（メンバーの心情・モチベーション）の両面から問題を捉える
- 維持管理（現状の問題）と改革（将来的な課題）の両方の視点を含める
- 問題の優先順位を明確に示す`);
    }

    if (targetScores.solution >= 3.5) {
      guidance.push(`【対策立案で${targetScores.solution}点を達成するには】
- 具体的なアクションステップ（誰が、何を、いつ、どのように）を明示する
- 短期・中期・長期の対策を体系的に整理する
- 各対策の優先順位と実施スケジュールを示す
- 想定されるリスクとその対応策を含める
- KPIや成功指標を設定する`);
    }

    if (targetScores.role >= 3.5) {
      guidance.push(`【役割理解で${targetScores.role}点を達成するには】★重要★
- 必ず「私は〜する」「私がリーダーとして〜」という主体的な一人称表現を使う
- 組織における自分の立場と責任を明確に示す
- 上司への報告・相談、部下への指示・支援、関係部門との調整など、各方向への役割を具体的に記述する
- 「〜すべき」「〜が必要」ではなく「私が〜を実行する」という当事者意識を示す
- マネジメントの基本的な役割（計画・組織化・指揮・統制）を意識した記述をする`);
    }

    if (targetScores.leadership >= 3.5) {
      guidance.push(`【主導で${targetScores.leadership}点を達成するには】
- 「私が率先して〜」「私が先頭に立って〜」という表現を使う
- 困難な状況でも諦めずに最後までやり遂げる姿勢を示す
- 自ら模範を示す具体的な行動を記述する
- メンバーの信頼を得るための具体的なアプローチを含める`);
    }

    if (targetScores.collaboration >= 3.5) {
      guidance.push(`【連携で${targetScores.collaboration}点を達成するには】
- 上司、関係部門、メンバーそれぞれとの連携方法を具体的に記述する
- 「〜と相談する」「〜に協力を依頼する」「〜と情報共有する」など具体的なアクションを示す
- 利害関係の調整方法を明確にする
- 部門を超えた連携の視点を含める`);
    }

    if (targetScores.development >= 3.5) {
      guidance.push(`【育成で${targetScores.development}点を達成するには】
- 「私がメンバーを育成する責任がある」という認識を示す
- 個々のメンバーの強み・弱み・成長ニーズを把握していることを示す
- 具体的な育成計画（OJT、面談、研修など）を記述する
- 期待と現状のギャップを踏まえた段階的な育成アプローチを示す`);
    }

    return guidance.length > 0
      ? `\n## 高スコア達成のための必須要件\n${guidance.join('\n\n')}\n`
      : '';
  };

  const prompt = `あなたは職場改善のスコア評価に精通した専門家です。

以下のシチュエーションについて、指定された目標スコアに相当する回答を生成してください。
参考として「類似回答者」の実際の回答を提示しますが、**目標スコアが類似回答者より高い場合は、類似回答者を超えるレベルの回答を生成してください。**

## シチュエーション
${situationText || '（シチュエーション情報なし）'}

## 目標スコア
- 問題把握: ${targetScores.problem}（満点5.0）
- 対策立案: ${targetScores.solution}（満点5.0）
- 役割理解: ${targetScores.role}（満点5.0）★特に重要
- 主導: ${targetScores.leadership}（満点4.0）
- 連携: ${targetScores.collaboration}（満点4.0）
- 育成: ${targetScores.development}（満点4.0）
${generateHighScoreGuidance()}
## 類似回答者の実際の回答（参考）
※類似回答者のスコアが目標より低い場合は、これを超えるレベルの回答を生成すること
${formatSimilarExamples()}

## 回答生成の指示（重要）

### 設問1（問題把握）の回答
- 問題を単に箇条書きで列挙するのではなく、問題の構造・関連性・根本原因を分析的に記述する
- 「〜が問題である」だけでなく「なぜそれが問題なのか」「どのような影響があるのか」まで踏み込む
- 業務面の問題と人（心情・モチベーション）の問題の両方を含める

### 設問2（対策立案・主導・連携・育成）の回答
- **必ず「私は〜する」「私が〜」という一人称で記述する**（これが役割理解・主導の評価に直結）
- 抽象的な方針ではなく、具体的なアクション（誰に、何を、いつ、どのように）を示す
- 上司・関係部門・メンバーそれぞれへの働きかけを具体的に記述する（連携の評価）
- メンバー育成の具体的な計画を含める（育成の評価）

## 出力形式
以下のJSON形式で出力してください。

\`\`\`json
{
  "q1Answer": "設問1への予測回答（問題の分析と構造化）",
  "q1Reason": "設問1の回答の理由（箇条書き3点まで）",
  "q2Answer": "設問2への予測回答（必ず一人称「私は〜」で記述）",
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
    const timeoutMs = 30000; // 30秒（長い回答生成のため）
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
          maxOutputTokens: 2048,
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

  if (scoreLevel >= 4.0) {
    // 高スコア（4.0以上）
    q1Answer = `本ケースの問題は、大きく以下の3つの層に分けて捉える必要がある。

【第1層：直接的な業務問題】
特注グラタンの仕様違いによる納品トラブルは、単なる確認ミスではなく、商品開発プロセスにおける情報共有体制の脆弱さを示している。

【第2層：人的・組織的問題】
新人・水木のメンタル面の問題は、大岩の指導方法に起因するが、その根本には「既存のやり方への固執」というチーム全体の文化的課題がある。私はリーダーとして、この状況を放置してきた責任がある。

【第3層：戦略的課題】
部長からの商品開発力強化の指示は、単なる業務改善ではなく、全社的な競争力強化に向けた変革を求めるものである。現状の延長線上ではなく、抜本的なプロセス改革が必要である。`;

    q2Answer = `私はリーダーとして、以下の対策を自ら率先して実行する。

【緊急対応（今週中）】
私が直接グルメ堂を訪問し、謝罪と今後の対応策を説明する。水木には同行させ、顧客対応の実践を学ばせる機会とする。

【短期対策（1ヶ月以内）】
1. 私が大岩と1on1面談を行い、指導方法の改善について話し合う。大岩の経験を尊重しつつ、新人育成の重要性を伝える。
2. 水木との週次面談を開始し、メンタル面のケアと成長目標の設定を行う。私自身がメンターとなり、具体的なスキルアップ計画を一緒に作成する。

【中期対策（3ヶ月以内）】
1. 商品開発プロセスの見直しを部長に提案し、承認を得た上でプロジェクトチームを立ち上げる。私がプロジェクトリーダーを務める。
2. 営業部との定例ミーティングを設定し、顧客ニーズの共有体制を構築する。私が営業部長に直接働きかけ、協力を取り付ける。
3. メンバー全員参加のワークショップを開催し、新しいプロセスへの理解と参画意識を高める。`;
  } else if (scoreLevel >= 3.5) {
    q1Answer = '現状の問題点を的確に把握し、根本原因を多角的な視点から分析しています。業務面の問題（納品トラブル、プロセスの非効率）と人的問題（新人のメンタル、指導方法）の両面を捉え、組織全体への影響を考慮した上で、優先順位を明確に設定できています。';
    q2Answer = '私はリーダーとして、具体的かつ実現可能な対策を複数提案し、それぞれのメリット・デメリットを考慮した上で最適な解決策を選択します。私が率先して上司への報告・相談を行い、関係部門との連携を図りながら、メンバー育成も含めた包括的な実施計画を実行します。';
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
