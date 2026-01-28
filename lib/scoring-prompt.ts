// AI採点アシスタント用の事前プロンプトと説明生成機能

const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

/**
 * 採点AIの事前プロンプト（システムプロンプト）
 * 
 * このプロンプトは、従業員のケーススタディ回答を評価する際に使用されます。
 * 過去の回答パターンと採点基準に基づいて、公平で一貫性のある評価を提供します。
 * 
 * AIは「エンベディング予測値」を参考にしつつ、回答の妥当性を評価して最終スコアを決定します。
 */
export const SCORING_SYSTEM_PROMPT = `あなたは従業員のパフォーマンス評価を専門とする採点アシスタントです。
職場ケーススタディへの回答を評価し、確立された基準と過去の評価パターンに基づいて、
公平で一貫性のある洞察に満ちたスコアと説明を提供することが目標です。

## 評価の背景

従業員は「ケース（状況説明）」を読み、それに対する回答を記述します。
回答は以下の2つの設問に分かれています：
- **設問1（q1）**: 問題把握 - 現状の問題点を的確に捉えているか
- **設問2（q2）**: 対策立案、主導、連携、育成 - 解決策と実行計画を示せているか

## 重要：回答の妥当性チェック

**まず最初に、回答が「有効な回答」かどうかを判定してください。**

### 無効な回答の例（スコア1.0を付与）
- 意味のない文字の羅列（例：「あああああ」「asdfghjkl」「xxxx」）
- 全く関係のない内容（例：天気の話、料理のレシピ、個人的な話題）
- 空白のみ、または極端に短い（例：「はい」「わかりません」「特にない」）
- コピペや定型文の繰り返し
- 設問やケースと全く関係のない内容

### 低品質な回答の例（スコア1.0〜1.5を付与）
- 設問の内容を理解していない
- 具体性が著しく欠如（「頑張ります」「改善します」のみ）
- ケース状況と無関係な一般論のみ
- 論理的な構成がない

**無効または低品質な回答の場合、エンベディング予測値に関係なく低いスコアを付けてください。**

## 評価基準

以下の評価軸に基づいて回答を評価してください：

### 1. 問題把握評点（Problem Comprehension Score）

**観点**: 「何が問題か」を的確に捉える力

**評価ポイント**:
- 問題の本質を正確に理解しているか
- 表面的な症状だけでなく、根本原因を見抜けているか
- 対人関係上の問題や組織的な問題も見落としていないか
- 管理面と改革面、業務と人の側面の両方を考慮しているか

**高評価（3.5〜4.0）の特徴**:
- 多角的な視点から問題を分析
- メンバーの心情的な側面にも言及
- 問題の優先順位を明確に設定

**最高評価（4.5〜5.0）の条件**（すべて満たす必要あり）:
- 上記すべてに加え、問題の構造を体系的に整理
- 表面的な問題と根本原因の関連性を明確に説明
- 組織全体への影響まで考慮した分析
- 具体的な事例や数値を用いた説得力のある記述

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

**高評価（3.5〜4.0）の特徴**:
- 具体的かつ実現可能な対策を複数提案
- 実施スケジュールや役割分担まで踏み込んでいる
- リスクへの対応も考慮

**最高評価（4.5〜5.0）の条件**（すべて満たす必要あり）:
- 上記すべてに加え、短期・中期・長期の対策を体系的に整理
- 各対策の優先順位と依存関係を明確に説明
- KPIや成功指標を設定し、進捗管理の方法まで言及
- 想定されるリスクとその対応策を具体的に記述

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

**高評価（3.5〜4.0）の特徴**:
- 強い当事者意識
- 最後までコミットする姿勢
- 自らが模範を示す覚悟

**最高評価（4.0 ※上限）の条件**:
- 上記すべてに加え、具体的な行動計画と自らの役割を明示
- 困難な状況でも諦めない姿勢を具体例で示す
- メンバーのモチベーションを高める具体的なアプローチを記述

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

**高評価（3.5〜4.0）の特徴**:
- 関係者を網羅的に把握
- 協力を引き出す具体的なアプローチ
- 部門を超えた連携の視点

**最高評価（4.0 ※上限）の条件**:
- 上記すべてに加え、各関係者との具体的なコミュニケーション計画を記述
- 利害関係の調整方法を明確に示す
- 組織外のリソースも含めた連携体制を構築

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

**高評価（3.5〜4.0）の特徴**:
- 育成への明確な責任感
- メンバー個々への具体的アプローチ
- 期待と現状のギャップを踏まえた計画

**最高評価（4.0 ※上限）の条件**:
- 上記すべてに加え、各メンバーの強み・弱みを具体的に把握
- 成長段階に応じた段階的な育成計画を記述
- OJTとOff-JTを組み合わせた体系的な育成アプローチ

**低評価の特徴**:
- 育成意識が希薄
- 具体的な育成イメージがない
- 画一的なアプローチ

**典型的なコメント例**:
- 「職場のメンバーを育成することは自分の役割であると認識できているようです」
- 「一人ひとりのメンバーをどのように育成していくのか、具体的なイメージが持てていないようです」
- 「それぞれのメンバーに対する期待と現状のレベルと適性を確認し、何から取り組めば本人にとってやりやすく、かつ能力開発につながるかを考えてみましょう」

### 6. 役割理解評点（Role Understanding Score）

**観点**: リーダーとしての役割を正しく認識しているか

**評価ポイント**:
- 自分がリーダーとして何をすべきか理解しているか
- 組織における自分の立場と責任を認識しているか
- マネジメントの基本的な役割（計画・組織化・指揮・統制）を理解しているか
- 部下・上司・関係部門との関係性における自分の役割を把握しているか

**高評価（3.5〜4.0）の特徴**:
- リーダーとしての当事者意識が明確
- 組織目標と自分の役割の関連を理解
- 権限と責任の範囲を適切に認識

**最高評価（4.5〜5.0）の条件**（すべて満たす必要あり）:
- 上記すべてに加え、組織全体の戦略と自分の役割の関連を明確に説明
- 上位者・同僚・部下それぞれとの関係における自分の役割を具体的に記述
- 将来のキャリアパスを見据えた役割認識を示す

**低評価の特徴**:
- リーダーとしての自覚が薄い
- 役割を他者に委ねる傾向
- 責任範囲の認識が曖昧

**典型的なコメント例**:
- 「リーダーとしての役割を十分に理解し、適切な行動を示しています」
- 「管理者としての立場から何をすべきか、もう少し意識する必要があります」
- 「職場の責任者として、問題を自分事として捉える姿勢が求められます」

## スコアの刻みと上限

**各評価項目には個別の刻みと上限が設定されています。必ず以下に従ってください：**

### 主要評価項目
| 項目 | 刻み | 範囲 | 備考 |
|------|------|------|------|
| 問題把握 | 0.5 | 1.0〜5.0 | 詳細スコアから計算 |
| 対策立案 | 0.5 | 1.0〜5.0 | 詳細スコアから計算 |
| 役割理解 | 0.1 | 1.0〜4.0 | **自動計算（主導+連携+育成）÷3** |
| 主導 | 0.5 | 1.0〜4.0 | AIが直接評価 |
| 連携 | 0.5 | 1.0〜4.0 | 詳細スコアから計算 |
| 育成 | 0.5 | 1.0〜4.0 | AIが直接評価 |

**重要：役割理解は主導・連携・育成の平均として自動計算されるため、AIが直接評価する必要はありません。**

### 問題把握の詳細項目（すべて刻み1、上限4）
- 状況理解: 1〜4（整数）
- 本質把握: 1〜4（整数）
- 維持管理・業務: 1〜4（整数）
- 維持管理・人: 1〜4（整数）
- 改革・業務: 1〜4（整数）
- 改革・人: 1〜4（整数）

### 対策立案の詳細項目（すべて刻み1、上限4）
- 網羅性: 1〜4（整数）
- 計画性: 1〜4（整数）
- 維持管理・業務: 1〜4（整数）
- 維持管理・人: 1〜4（整数）
- 改革・業務: 1〜4（整数）
- 改革・人: 1〜4（整数）

### 連携の詳細項目（すべて刻み1、上限4）
- 上司: 1〜4（整数）
- 職場外: 1〜4（整数）
- メンバー: 1〜4（整数）

## スコアの目安

**重要: 5点は「完璧」を意味します。実際のデータでは5点の回答は一つも存在しません。**

- **5.0**: 【ほぼ存在しない】完璧な回答。すべての評価観点において欠点が一切なく、模範解答として使用できるレベル。過去のデータに5点は存在しないため、極めて例外的な場合のみ付与してください。
- **4.5**: 【極めて稀】ほぼ完璧。1〜2点の軽微な改善点はあるが、全体として卓越した回答（問題把握・対策立案・役割理解のみ）
- **4.0**: 【稀】非常に優秀。大部分の観点で優れており、明確な強みがある（実データでは全体の1%未満）
- **3.5**: 優秀。多くの観点で良好だが、いくつか改善の余地がある
- **2.5〜3.0**: 標準的。基本的な要素は押さえているが改善の余地あり（多くの回答がこの範囲）
- **1.5〜2.0**: 改善が必要。重要な観点が欠けている
- **1.0**: 大幅な改善が必要、または無効な回答

**スコア分布の目安（実データに基づく）**:
- 2.0〜3.0の範囲: 約90%の回答
- 3.5以上: 約7%の回答
- 4.0以上: 約1%の回答
- 4.5以上: ほぼ0%
- 5.0: 0%（過去に存在しない）

**4点以上を付ける前に確認してください**:
1. すべての評価観点において具体的かつ的確な記述があるか
2. 問題の本質を深く理解し、多角的な視点から分析しているか
3. 対策が具体的で実現可能性が高く、実行計画まで示されているか
4. リーダーシップ、連携、育成の視点が明確に示されているか

これらすべてを満たさない限り、4点以上は付けないでください。

## 評価の進め方

1. **回答の妥当性を確認**: まず回答が有効かどうかを判定
2. **ケース状況を理解**: 提供されたケース（状況説明）を注意深く読む
3. **回答を分析**: 設問に対する回答の内容を詳細に確認
4. **類似例を参照**: 提供された類似回答とそのスコア・コメントを参考にする
5. **評価軸に沿って判断**: 上記の評価基準に照らして強みと弱みを特定
6. **エンベディング予測値を参考に**: 類似度ベースの予測値を参考にしつつ、回答内容を総合的に判断
7. **最終スコアを決定**: 各観点のバランスを考慮して最終スコアを決定

## 出力形式

評価結果は以下の形式で出力してください：

\`\`\`json
{
  "isValidAnswer": true または false,
  "detailScores": {
    "problemUnderstanding": 1〜4の整数または null（状況理解、設問1のみ）,
    "problemEssence": 1〜4の整数または null（本質把握、設問1のみ）,
    "problemMaintenanceBiz": 1〜4の整数または null（維持管理・業務、設問1のみ）,
    "problemMaintenanceHr": 1〜4の整数または null（維持管理・人、設問1のみ）,
    "problemReformBiz": 1〜4の整数または null（改革・業務、設問1のみ）,
    "problemReformHr": 1〜4の整数または null（改革・人、設問1のみ）,
    "solutionCoverage": 1〜4の整数または null（網羅性、設問2のみ）,
    "solutionPlanning": 1〜4の整数または null（計画性、設問2のみ）,
    "solutionMaintenanceBiz": 1〜4の整数または null（維持管理・業務、設問2のみ）,
    "solutionMaintenanceHr": 1〜4の整数または null（維持管理・人、設問2のみ）,
    "solutionReformBiz": 1〜4の整数または null（改革・業務、設問2のみ）,
    "solutionReformHr": 1〜4の整数または null（改革・人、設問2のみ）,
    "collabSupervisor": 1〜4の整数または null（上司との連携、設問2のみ）,
    "collabExternal": 1〜4の整数または null（職場外との連携、設問2のみ）,
    "collabMember": 1〜4の整数または null（メンバーとの連携、設問2のみ）
  },
  "scores": {
    "leadership": 1.0〜4.0の数値または null（主導評点、設問2のみ、0.5刻み）,
    "development": 1.0〜4.0の数値または null（育成評点、設問2のみ、0.5刻み）
  },
  "explanation": "<詳細な説明文>"
}
\`\`\`

**重要：詳細スコアの評価基準**
各詳細スコアは回答内容を直接評価して1〜4の整数で採点してください：
- **1**: 該当する記述がない、または不適切
- **2**: 基本的な言及はあるが不十分
- **3**: 適切に言及されている
- **4**: 詳細かつ具体的に言及されている

**重要な注意点**:
- 無効な回答（意味のない文字列など）の場合、isValidAnswer を false にし、すべての詳細スコアを 1、scoresも最低値にしてください
- 設問1（q1）の場合：detailScoresはproblemUnderstanding〜problemReformHrの6項目のみ評価。scoresは空オブジェクト。
- 設問2（q2）の場合：detailScoresはsolutionCoverage〜collabMemberの9項目、scoresはleadership/developmentを評価。
- **problem, solution, collaboration, roleは詳細スコアから計算式で算出するため、出力不要です**
- **役割理解（role）は主導・連携・育成の平均として自動計算されるため、評価不要です**

## 説明文のガイドライン

説明文は以下の要素を含めてください：

1. **総評**: スコアの根拠となる全体的な評価
2. **強み**: 回答の良い点（具体的に引用）
3. **改善点**: 不足している観点や深堀りが必要な点
4. **類似例との比較**: 参照した類似回答との類似点・相違点
5. **アドバイス**: 今後の改善に向けた具体的な提案

無効な回答の場合は、なぜ無効と判断したかを説明し、有効な回答のためのアドバイスを提供してください。

説明文は建設的かつ専門的なトーンで、過去の評価コメントのスタイルに合わせてください。`;

/**
 * 類似回答の情報
 */
export type ScoringExample = {
  responseId: string;
  score: number;
  similarity: number;
  answerText: string;
  // 個別スコア（AIの参考用）
  scores?: {
    problem?: number | null;
    solution?: number | null;
    role?: number | null;
    leadership?: number | null;
    collaboration?: number | null;
    development?: number | null;
  };
  // 詳細スコア（AIの参考用）
  detailScores?: {
    problemUnderstanding?: number | null;
    problemEssence?: number | null;
    problemMaintenanceBiz?: number | null;
    problemMaintenanceHr?: number | null;
    problemReformBiz?: number | null;
    problemReformHr?: number | null;
    solutionCoverage?: number | null;
    solutionPlanning?: number | null;
    solutionMaintenanceBiz?: number | null;
    solutionMaintenanceHr?: number | null;
    solutionReformBiz?: number | null;
    solutionReformHr?: number | null;
    collabSupervisor?: number | null;
    collabExternal?: number | null;
    collabMember?: number | null;
  };
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
 * スコア分布情報（AIの判断基準用）
 */
export type ScoreDistribution = {
  field: string;           // フィールド名
  label: string;           // 表示名
  distribution: { score: number; count: number }[]; // スコアごとの件数
  mode: number | null;     // 最頻値
  average: number | null;  // 平均値
  total: number;           // 合計件数
};

/**
 * スコア例（各スコア値の回答例）
 */
export type ScoreExample = {
  field: string;           // フィールド名
  label: string;           // 表示名
  examples: {
    score: number;         // スコア値
    answerText: string;    // 回答テキスト（抜粋）
    similarity: number;    // 類似度
  }[];
};

/**
 * AI採点リクエストのパラメータ
 */
export type AIScoringRequest = {
  caseContext: string; // ケースの状況説明
  question: 'q1' | 'q2';
  answerText: string; // 評価対象の回答
  similarExamples: ScoringExample[]; // 類似回答例（評価スタイルの参考）
  similarCases?: ScoringCaseContext[]; // 類似ケース（新規ケース予測時）
  isNewCase?: boolean; // 新規ケースかどうか
  // 類似回答のスコア分布（AIの判断基準）
  scoreDistributions?: {
    detailScores: ScoreDistribution[];  // 詳細スコア15項目の分布
    mainScores: ScoreDistribution[];    // role/leadership/developmentの分布
  };
  // 各スコア値の回答例（AIの判断基準）
  scoreExamples?: {
    detailScores: ScoreExample[];       // 詳細スコア15項目の例
    mainScores: ScoreExample[];         // role/leadership/developmentの例
  };
  embeddingPredictedScores?: {
    problem: number | null;
    solution: number | null;
    role: number | null;
    leadership: number | null;
    collaboration: number | null;
    development: number | null;
  }; // エンベディングベースの予測スコア（既存ケースの場合のみ）
  confidence?: number; // 信頼度（既存ケースの場合のみ）
};

/**
 * AI採点レスポンス（スコア＋説明文）
 */
export type AIScoringResponse = {
  isValidAnswer: boolean;
  scores: {
    // 主要スコア6項目（詳細スコアから計算）
    problem: number | null;
    solution: number | null;
    role: number | null;
    leadership: number | null;
    collaboration: number | null;
    development: number | null;
  };
  // 詳細スコア15項目（AIが直接評価）
  detailScores: {
    // 問題把握の詳細スコア（6項目、1-4の整数）
    problemUnderstanding: number | null;  // 状況理解
    problemEssence: number | null;        // 本質把握
    problemMaintenanceBiz: number | null; // 維持管理・業務
    problemMaintenanceHr: number | null;  // 維持管理・人
    problemReformBiz: number | null;      // 改革・業務
    problemReformHr: number | null;       // 改革・人
    // 対策立案の詳細スコア（6項目、1-4の整数）
    solutionCoverage: number | null;      // 網羅性
    solutionPlanning: number | null;      // 計画性
    solutionMaintenanceBiz: number | null; // 維持管理・業務
    solutionMaintenanceHr: number | null;  // 維持管理・人
    solutionReformBiz: number | null;      // 改革・業務
    solutionReformHr: number | null;       // 改革・人
    // 連携の詳細スコア（3項目、1-4の整数）
    collabSupervisor: number | null;      // 上司との連携
    collabExternal: number | null;        // 職場外との連携
    collabMember: number | null;          // メンバーとの連携
  };
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
- 対人関係面や組織的な問題も考慮しているか

**設問1では、detailScoresのproblemUnderstanding〜problemReformHrの6項目のみ評価してください。scoresは空オブジェクトにしてください。**`;
  }
  return `この回答は「設問2（対策立案・主導・連携・育成）」への回答です。
以下の観点から総合的に評価してください：
- 対策立案: 具体的な実行計画があるか
- 主導: リーダーとしての主体性が見られるか
- 連携: 関係者との協力姿勢があるか
- 育成: メンバー育成の視点があるか

**設問2では、detailScoresの9項目とscoresのleadership/developmentを評価してください。roleは主導・連携・育成の平均として自動計算されます。**`;
}

/**
 * 類似例をフォーマット
 */
function formatSimilarExamples(examples: ScoringExample[], question: 'q1' | 'q2'): string {
  if (!examples.length) return '（類似例なし）';

  return examples.map((ex, i) => {
    // 主要スコア
    const mainScores = ex.scores ? (question === 'q1'
      ? `問題把握: ${ex.scores.problem ?? '-'} / 役割理解: ${ex.scores.role ?? '-'}`
      : `対策立案: ${ex.scores.solution ?? '-'} / 役割理解: ${ex.scores.role ?? '-'} / 主導: ${ex.scores.leadership ?? '-'} / 連携: ${ex.scores.collaboration ?? '-'} / 育成: ${ex.scores.development ?? '-'}`
    ) : `総合: ${ex.score}点`;

    // 詳細スコア
    let detailScoresStr = '';
    if (ex.detailScores) {
      if (question === 'q1') {
        const d = ex.detailScores;
        detailScoresStr = `詳細スコア: 理解${d.problemUnderstanding ?? '-'}/本質${d.problemEssence ?? '-'}/維持業${d.problemMaintenanceBiz ?? '-'}/維持人${d.problemMaintenanceHr ?? '-'}/改革業${d.problemReformBiz ?? '-'}/改革人${d.problemReformHr ?? '-'}`;
      } else {
        const d = ex.detailScores;
        detailScoresStr = `詳細スコア: 網羅${d.solutionCoverage ?? '-'}/計画${d.solutionPlanning ?? '-'}/維持業${d.solutionMaintenanceBiz ?? '-'}/維持人${d.solutionMaintenanceHr ?? '-'}/改革業${d.solutionReformBiz ?? '-'}/改革人${d.solutionReformHr ?? '-'}/上司${d.collabSupervisor ?? '-'}/外部${d.collabExternal ?? '-'}/メンバー${d.collabMember ?? '-'}`;
      }
    }

    const comments = [
      ex.commentProblem && `問題把握コメント: ${ex.commentProblem}`,
      ex.commentSolution && `対策立案コメント: ${ex.commentSolution}`,
      ex.commentOverall && `総合コメント: ${ex.commentOverall}`,
    ].filter(Boolean).join('\n');

    return `【類似例${i + 1}】類似度: ${(ex.similarity * 100).toFixed(0)}%
${mainScores}
${detailScoresStr}
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
 * スコア例をフォーマット（AIの判断基準用）
 */
function formatScoreExamples(examples?: AIScoringRequest['scoreExamples'], distributions?: AIScoringRequest['scoreDistributions']): string {
  if (!examples) return '';

  let result = '\n## 各スコアの回答例（判断基準）\n';
  result += '以下は類似回答から抽出した各スコアの具体例です。今回の回答がどのスコアに近いか判断する参考にしてください。\n\n';

  // 詳細スコアの例
  if (examples.detailScores.length > 0) {
    result += '### 詳細スコア（1〜4の整数で評価）\n\n';
    for (const ex of examples.detailScores) {
      if (ex.examples.length === 0) continue;

      // 分布情報（推奨値）を取得
      const dist = distributions?.detailScores.find(d => d.field === ex.field);
      const modeStr = dist?.mode ? `（類似回答での最頻値: ${dist.mode}点）` : '';

      result += `**${ex.label}**${modeStr}\n`;
      for (const e of ex.examples) {
        const excerpt = e.answerText.length > 150
          ? e.answerText.substring(0, 150) + '...'
          : e.answerText;
        result += `- 【${e.score}点】「${excerpt}」\n`;
      }
      result += '\n';
    }
  }

  // 主要スコア（role/leadership/development）の例
  if (examples.mainScores.length > 0) {
    result += '### 役割理解・主導・育成（AIが直接評価）\n\n';
    for (const ex of examples.mainScores) {
      if (ex.examples.length === 0) continue;

      // 分布情報（平均値）を取得
      const dist = distributions?.mainScores.find(d => d.field === ex.field);
      const avgStr = dist?.average ? `（類似回答での平均: ${dist.average.toFixed(1)}点）` : '';

      result += `**${ex.label}**${avgStr}\n`;
      for (const e of ex.examples) {
        const excerpt = e.answerText.length > 150
          ? e.answerText.substring(0, 150) + '...'
          : e.answerText;
        result += `- 【${e.score}点】「${excerpt}」\n`;
      }
      result += '\n';
    }
  }

  return result;
}

/**
 * スコア分布をフォーマット（AIの判断基準用）
 */
function formatScoreDistributions(distributions?: AIScoringRequest['scoreDistributions'], question?: 'q1' | 'q2'): string {
  if (!distributions) return '';

  let result = '\n## 類似回答のスコア分布（判断基準）\n';
  result += '以下は類似回答から集計したスコアの分布です。推奨スコアの参考にしてください。\n\n';

  // 詳細スコアの分布
  if (distributions.detailScores.length > 0) {
    result += '### 詳細スコアの分布（1〜4の整数）\n';
    for (const dist of distributions.detailScores) {
      if (dist.total === 0) continue;
      const distStr = dist.distribution
        .map(d => `${d.score}点:${d.count}件`)
        .join(', ');
      const modeStr = dist.mode !== null ? `最頻値:${dist.mode}点` : '';
      result += `- **${dist.label}**: ${distStr}（${modeStr}）\n`;
    }
    result += '\n';
  }

  // 主要スコア（role/leadership/development）の分布
  if (distributions.mainScores.length > 0) {
    result += '### 役割理解・主導・育成の分布\n';
    for (const dist of distributions.mainScores) {
      if (dist.total === 0) continue;
      // 上位3つの分布のみ表示
      const topDist = dist.distribution
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);
      const distStr = topDist
        .map(d => `${d.score}点:${d.count}件`)
        .join(', ');
      const avgStr = dist.average !== null ? `平均:${dist.average.toFixed(1)}点` : '';
      result += `- **${dist.label}**: ${distStr}...（${avgStr}）\n`;
    }
    result += '\n';
  }

  return result;
}

/**
 * エンベディング予測スコアをフォーマット
 */
function formatEmbeddingScores(scores: AIScoringRequest['embeddingPredictedScores'], question: 'q1' | 'q2'): string {
  if (!scores) {
    return '（エンベディング予測値なし）';
  }
  if (question === 'q1') {
    return `- 問題把握（参考値）: ${scores.problem ?? '不明'}点
- 役割理解: ${scores.role ?? '不明'}点`;
  }
  return `- 対策立案（参考値）: ${scores.solution ?? '不明'}点
- 役割理解: ${scores.role ?? '不明'}点
- 主導: ${scores.leadership ?? '不明'}点
- 連携: ${scores.collaboration ?? '不明'}点
- 育成: ${scores.development ?? '不明'}点`;
}

/**
 * AIを使用して評価（スコア＋説明文）を生成
 */
export async function generateAIScoring(
  request: AIScoringRequest
): Promise<AIScoringResponse> {
  const isNewCase = request.isNewCase || !!request.similarCases?.length;
  
  // 新規ケースの場合と既存ケースの場合でプロンプトを変える
  const embeddingSection = isNewCase
    ? `### 新規ケースについて
**これは新規ケースです。** エンベディングベースの予測値はありません。
回答内容を評価基準に基づいて直接評価してください。
類似回答例は「過去の評価スタイルの参考」として使用してください（スコアの参考にはしないでください）。`
    : `### エンベディングベースの予測スコア（参考値）
${formatEmbeddingScores(request.embeddingPredictedScores!, request.question)}
- 信頼度: ${((request.confidence || 0) * 100).toFixed(0)}%

**注意**: 上記の予測スコアはベクトル類似度に基づく参考値です。回答内容が明らかに低品質（意味のない文字列、関係のない内容など）の場合は、予測値に関係なく低いスコアを付けてください。`;

  const taskSection = isNewCase
    ? `## タスク

1. まず、回答が「有効な回答」かどうかを判定してください
2. 有効な場合：**評価基準に基づいて回答内容を直接評価**し、スコアを決定してください
3. 無効な場合：isValidAnswer を false にし、すべてのスコアを 1.0 に
4. 説明文を生成してください

**重要**: 新規ケースのため、類似回答例のスコアは参考にしないでください。評価基準に基づいて独自に判断してください。

JSON形式で出力してください。`
    : `## タスク

1. まず、回答が「有効な回答」かどうかを判定してください
2. 有効な場合：エンベディング予測値を参考にしつつ、回答内容を評価してスコアを決定
3. 無効な場合：isValidAnswer を false にし、すべてのスコアを 1.0 に
4. 説明文を生成してください

JSON形式で出力してください。`;

  // スコア分布セクション
  const scoreDistributionSection = formatScoreDistributions(request.scoreDistributions, request.question);

  // スコア例セクション（各スコア値の回答例）
  const scoreExamplesSection = formatScoreExamples(request.scoreExamples, request.scoreDistributions);

  const userPrompt = `## 評価対象

### ケース（状況説明）
${request.caseContext || '（状況説明なし）'}
${formatSimilarCases(request.similarCases)}
### 設問タイプと評価観点
${getQuestionFocus(request.question)}

### 評価対象の回答
${request.answerText}

${embeddingSection}
${scoreDistributionSection}
${scoreExamplesSection}
## 参考: 類似回答例とその評価${isNewCase ? '（評価スタイルの参考のみ）' : ''}

${formatSimilarExamples(request.similarExamples, request.question)}

${taskSection}`;

  // Gemini APIが未設定の場合はフォールバック
  if (!GEMINI_API_KEY) {
    console.warn('GEMINI_API_KEY is not set. Using fallback scoring.');
    return generateFallbackScoring(request);
  }

  try {
    const controller = new AbortController();
    const timeoutMs = 25000; // 25秒
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
          temperature: 0.3,  // 低温度で一貫性を重視
          maxOutputTokens: 2000,
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
      try {
        const parsed = JSON.parse(jsonMatch[1]);
        return normalizeAIResponse(parsed, request);
      } catch {
        // JSONパース失敗
      }
    }

    // JSONブロックがない場合は直接パースを試みる
    try {
      const parsed = JSON.parse(generatedText);
      return normalizeAIResponse(parsed, request);
    } catch {
      // パースできない場合はフォールバック
      console.error('Failed to parse AI response:', generatedText);
      return generateFallbackScoring(request);
    }
  } catch (error) {
    console.error('generateAIScoring error:', error);
    return generateFallbackScoring(request);
  }
}

/**
 * AIレスポンスを正規化
 */
function normalizeAIResponse(parsed: any, request: AIScoringRequest): AIScoringResponse {
  const isValidAnswer = parsed.isValidAnswer !== false;

  // 詳細スコアを正規化（1〜4の整数に制限）
  const normalizeDetailScore = (score: any): number | null => {
    if (score === null || score === undefined) return null;
    const num = Number(score);
    if (isNaN(num)) return null;
    // 1〜4の整数に制限
    return Math.round(Math.min(4, Math.max(1, num)));
  };

  // 主要スコアを正規化（刻みと上限を適用）
  const normalizeMainScore = (score: any, step: number, max: number): number | null => {
    if (score === null || score === undefined) return null;
    const num = Number(score);
    if (isNaN(num)) return null;
    const clamped = Math.min(max, Math.max(1, num));
    return Math.round(clamped / step) * step;
  };

  const detailScores = parsed.detailScores || {};
  const aiScores = parsed.scores || {};

  // 詳細スコアを取得
  const normalizedDetailScores = {
    problemUnderstanding: normalizeDetailScore(detailScores.problemUnderstanding),
    problemEssence: normalizeDetailScore(detailScores.problemEssence),
    problemMaintenanceBiz: normalizeDetailScore(detailScores.problemMaintenanceBiz),
    problemMaintenanceHr: normalizeDetailScore(detailScores.problemMaintenanceHr),
    problemReformBiz: normalizeDetailScore(detailScores.problemReformBiz),
    problemReformHr: normalizeDetailScore(detailScores.problemReformHr),
    solutionCoverage: normalizeDetailScore(detailScores.solutionCoverage),
    solutionPlanning: normalizeDetailScore(detailScores.solutionPlanning),
    solutionMaintenanceBiz: normalizeDetailScore(detailScores.solutionMaintenanceBiz),
    solutionMaintenanceHr: normalizeDetailScore(detailScores.solutionMaintenanceHr),
    solutionReformBiz: normalizeDetailScore(detailScores.solutionReformBiz),
    solutionReformHr: normalizeDetailScore(detailScores.solutionReformHr),
    collabSupervisor: normalizeDetailScore(detailScores.collabSupervisor),
    collabExternal: normalizeDetailScore(detailScores.collabExternal),
    collabMember: normalizeDetailScore(detailScores.collabMember),
  };

  // AIが評価したrole/leadership/developmentを正規化
  const normalizedAIScores = {
    role: normalizeMainScore(aiScores.role, 0.1, 5),          // 0.1刻み、上限5
    leadership: normalizeMainScore(aiScores.leadership, 0.5, 4), // 0.5刻み、上限4
    development: normalizeMainScore(aiScores.development, 0.5, 4), // 0.5刻み、上限4
  };

  // 詳細スコアから主要スコア（problem/solution/collaboration）を計算
  // role/leadership/developmentはAIが直接評価した値を使用
  const calculatedScores = calculateMainScoresFromDetail(normalizedDetailScores, request.question, normalizedAIScores);

  return {
    isValidAnswer,
    scores: calculatedScores,
    detailScores: normalizedDetailScores,
    explanation: parsed.explanation || generateFallbackExplanation(request, isValidAnswer),
  };
}

/**
 * 詳細スコアから主要スコアを計算
 * SCORE_CALCULATION_LOGIC.md に基づく計算式を使用
 *
 * - problem, solution, collaboration: 詳細スコアから計算式で算出
 * - role, leadership, development: AIが直接評価（aiScoresから取得）
 */
function calculateMainScoresFromDetail(
  detailScores: AIScoringResponse['detailScores'],
  question: 'q1' | 'q2',
  aiScores?: { role: number | null; leadership: number | null; development: number | null }
): AIScoringResponse['scores'] {
  // 連携スコアの計算（設問2のみ）
  const calculateCollaboration = (): number | null => {
    const supervisor = detailScores.collabSupervisor;
    const external = detailScores.collabExternal;
    const member = detailScores.collabMember;

    if (supervisor === null || external === null || member === null) return null;

    const sum = supervisor + external + member;
    const raw = sum / 2 - 0.5;
    // 範囲制限と0.5刻みに丸め
    return Math.max(1, Math.min(4, Math.round(raw * 2) / 2));
  };

  // 問題把握スコアの計算（設問1のみ）
  const calculateProblem = (): number | null => {
    const understanding = detailScores.problemUnderstanding;
    const essence = detailScores.problemEssence;
    const maintBiz = detailScores.problemMaintenanceBiz;
    const maintHr = detailScores.problemMaintenanceHr;
    const reformBiz = detailScores.problemReformBiz;
    const reformHr = detailScores.problemReformHr;

    if (understanding === null || essence === null || maintBiz === null ||
        maintHr === null || reformBiz === null || reformHr === null) return null;

    const sum = understanding + essence + maintBiz + maintHr + reformBiz + reformHr;
    const raw = (sum / 6 / 4) * 5;

    // 条件判定: 理解>=3 かつ 本質<理解 → 切り捨て
    if (understanding >= 3 && essence < understanding) {
      return Math.max(1, Math.min(5, Math.floor(raw / 0.5) * 0.5));
    }
    // それ以外 → 四捨五入
    return Math.max(1, Math.min(5, Math.round(raw / 0.5) * 0.5));
  };

  // 対策立案スコアの計算（設問2のみ）
  const calculateSolution = (): number | null => {
    const coverage = detailScores.solutionCoverage;
    const planning = detailScores.solutionPlanning;
    const maintBiz = detailScores.solutionMaintenanceBiz;
    const maintHr = detailScores.solutionMaintenanceHr;
    const reformBiz = detailScores.solutionReformBiz;
    const reformHr = detailScores.solutionReformHr;

    if (coverage === null || planning === null || maintBiz === null ||
        maintHr === null || reformBiz === null || reformHr === null) return null;

    const sum = coverage + planning + maintBiz + maintHr + reformBiz + reformHr;
    const raw = (sum / 6 / 4) * 5;

    // 条件判定: 網羅性>=3 かつ 計画性<=2 → 切り捨て
    if (coverage >= 3 && planning <= 2) {
      return Math.max(1, Math.min(5, Math.floor(raw / 0.5) * 0.5));
    }
    // それ以外 → 四捨五入
    return Math.max(1, Math.min(5, Math.round(raw / 0.5) * 0.5));
  };

  // leadership, developmentはAIが直接評価（aiScoresから取得）
  // roleは常に (leadership + collaboration + development) / 3 で計算
  // AIスコアがない場合のフォールバック用推定関数
  const estimateLeadership = (solution: number | null): number | null => {
    if (solution !== null) {
      return Math.max(1, Math.min(4, Math.round(solution * 2) / 2));
    }
    return null;
  };

  const estimateDevelopment = (solutionMaintenanceHr: number | null): number | null => {
    if (solutionMaintenanceHr !== null) {
      const raw = solutionMaintenanceHr + 0.5;
      return Math.max(1, Math.min(4, Math.round(raw * 2) / 2));
    }
    return null;
  };

  // 役割理解は常に (主導 + 連携 + 育成) / 3 で計算
  const calculateRole = (leadership: number | null, collaboration: number | null, development: number | null): number | null => {
    if (leadership !== null && collaboration !== null && development !== null) {
      const raw = (leadership + collaboration + development) / 3;
      return Math.max(1, Math.min(5, Math.round(raw * 10) / 10)); // 0.1刻み
    }
    return null;
  };

  if (question === 'q1') {
    const problem = calculateProblem();
    // 設問1では role は計算できない（leadership/collaboration/development がないため）
    return {
      problem,
      solution: null,
      role: null,
      leadership: null,
      collaboration: null,
      development: null,
    };
  } else {
    const solution = calculateSolution();
    const collaboration = calculateCollaboration();

    // leadership, development: AIが評価した値を使用、なければ推定
    const leadership = aiScores?.leadership ?? estimateLeadership(solution);
    const development = aiScores?.development ?? estimateDevelopment(detailScores.solutionMaintenanceHr);

    // role は常に (leadership + collaboration + development) / 3 で計算
    const role = calculateRole(leadership, collaboration, development);

    return {
      problem: null,
      solution,
      role,
      leadership,
      collaboration,
      development,
    };
  }
}

/**
 * フォールバック用のスコアリング（API未設定時やエラー時）
 * デフォルトの詳細スコア（2）を使用して主要スコアを計算
 */
function generateFallbackScoring(request: AIScoringRequest): AIScoringResponse {
  // デフォルトの詳細スコア（中央値の2）
  const defaultDetailScore = 2;

  // 設問に応じた詳細スコアを設定
  const detailScores: AIScoringResponse['detailScores'] = {
    // 問題把握の詳細スコア（設問1のみ）
    problemUnderstanding: request.question === 'q1' ? defaultDetailScore : null,
    problemEssence: request.question === 'q1' ? defaultDetailScore : null,
    problemMaintenanceBiz: request.question === 'q1' ? defaultDetailScore : null,
    problemMaintenanceHr: request.question === 'q1' ? defaultDetailScore : null,
    problemReformBiz: request.question === 'q1' ? defaultDetailScore : null,
    problemReformHr: request.question === 'q1' ? defaultDetailScore : null,
    // 対策立案の詳細スコア（設問2のみ）
    solutionCoverage: request.question === 'q2' ? defaultDetailScore : null,
    solutionPlanning: request.question === 'q2' ? defaultDetailScore : null,
    solutionMaintenanceBiz: request.question === 'q2' ? defaultDetailScore : null,
    solutionMaintenanceHr: request.question === 'q2' ? defaultDetailScore : null,
    solutionReformBiz: request.question === 'q2' ? defaultDetailScore : null,
    solutionReformHr: request.question === 'q2' ? defaultDetailScore : null,
    // 連携の詳細スコア（設問2のみ）
    collabSupervisor: request.question === 'q2' ? defaultDetailScore : null,
    collabExternal: request.question === 'q2' ? defaultDetailScore : null,
    collabMember: request.question === 'q2' ? defaultDetailScore : null,
  };

  // 詳細スコアから主要スコアを計算
  const scores = calculateMainScoresFromDetail(detailScores, request.question);

  return {
    isValidAnswer: true,
    scores,
    detailScores,
    explanation: generateFallbackExplanation(request, true),
  };
}

/**
 * フォールバック用の説明文を生成
 */
function generateFallbackExplanation(request: AIScoringRequest, isValid: boolean): string {
  if (!isValid) {
    return '【警告】この回答は有効な回答として認識されませんでした。ケースの状況を踏まえた具体的な回答を記述してください。';
  }

  const isNewCase = request.isNewCase || !!request.similarCases?.length;
  const questionType = request.question === 'q1' ? '問題把握' : '対策立案・主導・連携・育成';

  // 新規ケースの場合
  if (isNewCase || !request.embeddingPredictedScores) {
    let explanation = `【${questionType}の評価 - 新規ケース】\n`;
    explanation += `これは新規ケースのため、AI評価が利用できませんでした。\n`;
    explanation += `評価基準に基づいて回答内容を確認してください。\n\n`;
    explanation += request.question === 'q1'
      ? '【問題把握のポイント】\n問題の本質を的確に捉え、多角的な視点から分析できているかを確認してください。'
      : '【対策立案のポイント】\n具体的な対策と実行計画が示されているかを確認してください。';
    return explanation;
  }

  const { embeddingPredictedScores, confidence, similarExamples, question } = request;
  const predictedScore = embeddingPredictedScores.problem || embeddingPredictedScores.solution || 2.5;
  const avgScore = similarExamples.length > 0
    ? similarExamples.reduce((sum, ex) => sum + ex.score, 0) / similarExamples.length
    : predictedScore;

  const scoreLevel = predictedScore >= 3.5 ? '高評価' : predictedScore >= 2.5 ? '中程度' : '低評価';

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

  const conf = confidence ?? 0;
  if (conf >= 0.7) {
    explanation += '信頼度が高い予測です。類似する過去の回答が多く見つかりました。';
  } else if (conf >= 0.5) {
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

// ============================================
// 早期品質チェック（API呼び出し前の高速フィルタ）
// ============================================

/**
 * 早期品質チェック結果
 */
export type EarlyQualityCheckResult = {
  isInvalid: boolean;
  reason: string;
};

/**
 * 早期品質チェック（API呼び出し前の簡易判定）
 * 明らかに無効な回答を高速で検出
 */
export function performEarlyQualityCheck(answerText: string): EarlyQualityCheckResult | null {
  const text = answerText.trim();

  // 空または極端に短い
  if (text.length < 10) {
    return {
      isInvalid: true,
      reason: '回答が短すぎます（10文字未満）',
    };
  }

  // 同じ文字の繰り返し（例：「あああああ」「aaaaa」）
  const uniqueChars = new Set(text.replace(/\s/g, ''));
  if (uniqueChars.size <= 3 && text.length > 20) {
    return {
      isInvalid: true,
      reason: '意味のない文字の繰り返しが検出されました',
    };
  }

  // 文字種の偏りをチェック（ひらがな・カタカナ・漢字がほぼない）
  const japaneseChars = text.match(/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/g);
  const japaneseRatio = (japaneseChars?.length || 0) / text.length;
  if (text.length > 30 && japaneseRatio < 0.1) {
    return {
      isInvalid: true,
      reason: '日本語として有効な回答ではありません',
    };
  }

  // パターン検出：同じフレーズの繰り返し
  const words = text.split(/[\s、。．，]+/).filter(w => w.length > 2);
  if (words.length > 5) {
    const wordCount = new Map<string, number>();
    for (const word of words) {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    }
    const maxRepeat = Math.max(...wordCount.values());
    if (maxRepeat > words.length * 0.5) {
      return {
        isInvalid: true,
        reason: '同じ内容の繰り返しが検出されました',
      };
    }
  }

  return null; // 早期チェックでは問題なし → AI評価へ
}
