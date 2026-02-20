// Google Gemini API クライアント
// LLMによる解答生成（RAG: Retrieval-Augmented Generation）
// PE-01: 予測応答時間5秒以内を目標

import type { PredictionResponse, Scores, PersonalityTraits } from '@/types';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

// q2 用のテキスト結合ヘルパー
function combineQ2Answers(r: { answer_q2?: string | null; answer_q3?: string | null; answer_q4?: string | null; answer_q5?: string | null; answer_q6?: string | null; answer_q7?: string | null; answer_q8?: string | null }): string {
  return [r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8]
    .filter(Boolean)
    .join('\n') || '（なし）';
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
- 「私は〜する」「私が〜」という一人称表現を使用
- 組織における自分の立場と責任を明示
- 上司への報告・相談、部下への指示・支援、関係部門との調整を具体的に記述
- 「〜すべき」ではなく「私が〜を実行する」という当事者意識`);
    }

    if (targetScores.leadership >= 3.5) {
      guidance.push(`【主導で${targetScores.leadership}点を達成するには】
- 「私が率先して〜」「私が先頭に立って〜」という表現
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
- **丁寧語（〜です・〜ます）は絶対に使用しない。常体で簡潔に記述する**
- 手書き解答を前提とし、長文化しない
- **解答冒頭に設問をなぞる宣言文は入れない**（「設問1の問題は〜」「私がまず行うことは〜」などは禁止）
- 内容から直接書き始める
- **文頭の接続詞は使用しない**（「まず」「次に」「そのため」「したがって」などは禁止）
- 構成を説明するような表現は避ける

### 分量制約（重要）
- 解答欄の物理的な狭さを前提とし、必要最低限の情報のみ記述する
- 一文あたりの情報量を高め、冗長な補足や言い換えは行わない
- 説明的・網羅的な文章にならないよう制限する

### 設問1（問題把握）の解答
- 問題を単に箇条書きで列挙するのではなく、問題の構造・関連性・根本原因を分析的に記述する
- 「〜が問題である」だけでなく「なぜそれが問題なのか」「どのような影響があるのか」まで踏み込む
- 業務面の問題と人（心情・モチベーション）の問題の両方を含める

### 設問2（対策立案・主導・連携・育成）の解答
- **必ず「私は〜する」「私が〜」という一人称で記述する**（これが役割理解・主導の評価に直結）
- 抽象的な方針ではなく、具体的なアクション（誰に、何を、いつ、どのように）を示す
- 上司・関係部門・メンバーそれぞれへの働きかけを具体的に記述する（連携の評価）
- メンバー育成の具体的な計画を含める（育成の評価）

## 出力形式
以下のJSON形式で出力してください。

\`\`\`json
{
  "q1Answer": "設問1への予測解答（問題の分析と構造化）",
  "q1Reason": "設問1の解答の理由（箇条書き3点まで）",
  "q2Answer": "設問2への予測解答（必ず一人称「私は〜」で記述）",
  "q2Reason": "設問2の解答の理由（箇条書き3点まで）"
}
\`\`\``;

  // Gemini API呼び出し
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY (or GOOGLE_API_KEY) is not set. Returning mock response.');
    return generateMockPrediction(targetScores);
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 30000; // 30秒（長い解答生成のため）
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
        q1Answer: parsed.q1Answer || '予測解答を生成できませんでした',
        q1Reason: parsed.q1Reason || undefined,
        q2Answer: parsed.q2Answer || '予測解答を生成できませんでした',
        q2Reason: parsed.q2Reason || undefined,
      };
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return {
        q1Answer: parsed.q1Answer || '予測解答を生成できませんでした',
        q1Reason: parsed.q1Reason || undefined,
        q2Answer: parsed.q2Answer || '予測解答を生成できませんでした',
        q2Reason: parsed.q2Reason || undefined,
      };
    } catch {
      return {
        q1Answer: generatedText.substring(0, 500),
        q2Answer: '（解答の分離に失敗しました）',
      };
    }
  } catch (error) {
    console.error('generatePredictionFromSimilar error:', error);
    return generateMockPrediction(targetScores);
  }
}

// モック予測解答を生成（API未設定時やエラー時用）
function generateMockPrediction(
  targetScores: Scores
): PredictionResponse {
  const scoreLevel = (targetScores.problem + targetScores.solution) / 2;

  let q1Answer: string;
  let q2Answer: string;

  if (scoreLevel >= 4.0) {
    // 高スコア（4.0以上）
    q1Answer = `特注グラタン仕様違いの納品トラブルは確認ミスではなく、商品開発プロセスの情報共有体制の脆弱さを示す。

水木のメンタル面の問題は大岩の指導方法に起因、根本には「既存のやり方への固執」というチーム全体の文化的課題がある。

部長からの商品開発力強化指示は全社的な競争力強化に向けた変革を求めるもので、抜本的なプロセス改革が必要。`;

    q2Answer = `私がグルメ堂を訪問し謝罪と対応策を説明、水木を同行させ顧客対応を学ばせる。

大岩と1on1面談で指導方法改善を話し合う。水木との週次面談でメンタルケアと成長目標設定、私がメンターとなりスキルアップ計画を作成。

商品開発プロセス見直しを部長に提案、承認後プロジェクトチーム立上げ。営業部との定例ミーティング設定、私が営業部長に働きかけ協力を得る。`;
  } else if (scoreLevel >= 3.5) {
    q1Answer = '業務問題（納品トラブル、プロセス非効率）と人的問題（新人メンタル、指導方法）の両面を捉え、根本原因を多角的に分析。組織への影響考慮の上、優先順位を設定。';
    q2Answer = '私が上司へ報告・相談を行い、関係部門と連携を図る。具体的対策を複数立案、メリット・デメリットを考慮し最適解を選択。メンバー育成計画も実行。';
  } else if (scoreLevel >= 2.5) {
    q1Answer = '主要な問題点は認識、原因分析もある程度実施。一部の視点が不足している可能性あり。';
    q2Answer = '基本的な対策は提案できているが、具体的な実施方法やリスク対応が不足。';
  } else {
    q1Answer = '問題把握が表面的、深い原因分析が必要。関係者視点からの検討も求められる。';
    q2Answer = '対策提案はあるが、具体性・実現可能性の検討が不足。';
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
