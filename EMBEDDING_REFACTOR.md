# Embedding処理の根本修正計画

## 現状の問題

### 設問構造の誤解

現在の実装:
```
answer_q1 → 'problem' としてembedding
answer_q2 → 'solution' としてembedding
```

実際の構造:
```
設問1（箇条書き）: answer_q1 のみ
設問2（文章）    : answer_q2 + q3 + q4 + q5 + q6 + q7 + q8 を結合
```

### スコアとの関係

- `score_problem`（問題把握）と `score_solution`（対策立案）は**評価軸のスコア**
- 設問1 = problem、設問2 = solution **ではない**
- 回答全体を評価した結果としてのスコア

---

## 修正方針

### 新しいラベリング

| 旧ラベル | 新ラベル | 内容 |
|----------|----------|------|
| `problem` | `q1` | 設問1の回答（answer_q1） |
| `solution` | `q2` | 設問2の回答（answer_q2〜q8を結合） |

### 設問テキストの保存（新機能）

設問の質問文を管理者が手入力し、以下の両方を保存する：
- **生テキスト**: そのままの質問文
- **Embedding**: 質問文のベクトル表現

---

## 新規追加: 設問管理機能

### 1. DBテーブル追加

#### `questions` テーブル（新規作成）

```sql
CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id TEXT NOT NULL REFERENCES cases(case_id) ON DELETE CASCADE,
  question_key TEXT NOT NULL,           -- 'q1', 'q2'
  question_text TEXT NOT NULL,          -- 質問文（生テキスト）
  question_embedding vector(768),       -- 質問文のembedding
  embedding_model TEXT,                 -- 使用したモデル名
  order_index INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(case_id, question_key)
);

-- インデックス
CREATE INDEX idx_questions_case_id ON questions(case_id);
CREATE INDEX idx_questions_embedding ON questions USING ivfflat (question_embedding vector_cosine_ops);
```

### 2. 型定義追加

#### `/types/database.ts` に追加

```typescript
questions: {
  Row: {
    id: string;
    case_id: string;
    question_key: 'q1' | 'q2';
    question_text: string;
    question_embedding: number[] | null;
    embedding_model: string | null;
    order_index: number;
    created_at: string;
    updated_at: string;
  };
  Insert: {
    id?: string;
    case_id: string;
    question_key: 'q1' | 'q2';
    question_text: string;
    question_embedding?: number[] | null;
    embedding_model?: string | null;
    order_index?: number;
    created_at?: string;
    updated_at?: string;
  };
  Update: {
    question_text?: string;
    question_embedding?: number[] | null;
    embedding_model?: string | null;
    order_index?: number;
    updated_at?: string;
  };
};
```

#### `/types/index.ts` に追加

```typescript
export interface Question {
  id: string;
  case_id: string;
  question_key: 'q1' | 'q2';
  question_text: string;
  question_embedding: number[] | null;
  order_index: number;
}
```

### 3. 管理者UI（設問入力画面）

#### 新規ファイル: `/app/admin/questions/page.tsx`

設問管理ページ:
- ケース選択
- 設問1（q1）の質問文入力
- 設問2（q2）の質問文入力
- 保存ボタン（テキスト + embedding同時保存）

#### 新規ファイル: `/app/admin/questions/QuestionsClient.tsx`

```typescript
// 機能:
// 1. ケース一覧をドロップダウンで表示
// 2. 選択したケースの既存設問を取得・表示
// 3. 設問テキストを編集
// 4. 保存時にテキスト + embedding を同時生成・保存
```

### 4. Server Actions追加

#### 新規ファイル: `/actions/questions.ts`

```typescript
'use server';

// 設問一覧を取得
export async function fetchQuestions(caseId: string): Promise<Question[]>

// 設問を保存（テキスト + embedding同時生成）
export async function saveQuestion(params: {
  caseId: string;
  questionKey: 'q1' | 'q2';
  questionText: string;
}): Promise<{ success: boolean; error?: string }>

// 内部処理:
// 1. questionText を embedText() でembedding化
// 2. questions テーブルに upsert（テキスト + embedding両方保存）
```

### 5. クエリ関数追加

#### `/lib/supabase/queries.ts` に追加

```typescript
// 設問を取得
export async function getQuestionsByCase(
  caseId: string
): Promise<Question[]>

// 設問を保存（upsert）
export async function upsertQuestion(
  data: {
    case_id: string;
    question_key: 'q1' | 'q2';
    question_text: string;
    question_embedding: number[];
    embedding_model: string;
  },
  token: string
): Promise<void>
```

### 6. 管理者サイドバー更新

#### `/components/layout/Sidebar.tsx`

設問管理へのリンクを追加:
```typescript
{ href: '/admin/questions', label: '設問管理', icon: FileQuestion }
```

---

## 設問embeddingの活用方法

### スコア予測での活用

現在:
```
回答のembedding ←→ 過去回答のembedding で類似検索
```

改善後:
```
(質問embedding + 回答embedding) ←→ (質問embedding + 過去回答embedding)
```

または:
```
1. 質問embeddingで「同じ質問への回答」をフィルタリング
2. その中で回答embeddingの類似検索
```

### LLMプロンプトでの活用

```typescript
// 回答予測時のプロンプトに質問文を含める
const prompt = `
ケース: ${situationText}

【設問1】${question1Text}
【設問2】${question2Text}

以下のスコアを目指す回答を生成してください...
`;
```

---

## 修正対象ファイル一覧

### 1. DBテーブル定義・マイグレーション

#### `/types/database.ts`
- **行300**: `embedding_queue.question` の型を `'q1' | 'q2'` に変更
- **行340**: `response_embeddings.question` の型を `'q1' | 'q2'` に変更
- **行386**: `typical_examples.question` の型を `'q1' | 'q2'` に変更

#### `/DATABASE_FUNCTION.sql`
- **行25-26**: `p_question = 'problem'` → `p_question = 'q1'` に変更
- **行34-36**: answer_text の取得ロジックを修正
  - `q1` → answer_q1
  - `q2` → answer_q2〜q8を結合

### 2. CSVアップロード処理

#### `/app/api/admin/upload/route.ts`
- **行299-306**: embeddingキュー投入ロジックを修正
  ```typescript
  // 旧
  if (r.answer_q1) jobs.push({ question: 'problem' });
  if (r.answer_q2) jobs.push({ question: 'solution' });

  // 新
  if (r.answer_q1) jobs.push({ question: 'q1' });
  // q2〜q8のいずれかがあれば
  if (r.answer_q2 || r.answer_q3 || ... || r.answer_q8) {
    jobs.push({ question: 'q2' });
  }
  ```

- **行308-316, 358-365**: touchedBuckets のスコア帯トラッキング
  - ここは score_problem/score_solution のままでOK（評価軸は変わらない）
  - ただしembeddingの question ラベルとは分離する必要あり

### 3. Embedding生成処理（Worker）

#### `/lib/prepare/worker.ts`
- **行102-103**: テキスト取得ロジックを修正
  ```typescript
  // 旧
  const text = job.question === 'problem' ? src?.answer_q1 : src?.answer_q2;

  // 新
  const text = job.question === 'q1'
    ? src?.answer_q1
    : [src?.answer_q2, src?.answer_q3, src?.answer_q4,
       src?.answer_q5, src?.answer_q6, src?.answer_q7, src?.answer_q8]
        .filter(Boolean).join('\n');
  ```

- **行103**: スコア取得ロジック
  - 要検討: q1/q2 にどのスコアを紐づけるか？
  - 案1: 両方とも score_overall を使う
  - 案2: 設問ごとのスコアを新たに定義
  - 案3: score_problem と score_solution の平均を使う

- **行253-254**: 典型例の代表テキスト取得も同様に修正

### 4. スコア予測処理

#### `/lib/scoring.ts`
- **行33**: `question: 'problem' | 'solution'` → `question: 'q1' | 'q2'`
- **行47-52**: DB関数呼び出し時の p_question を修正

#### `/actions/predictScore.ts`
- **行44**: パラメータ型を修正
- UI側との整合性を確認

### 5. 回答予測処理

#### `/actions/predict.ts`
- 直接 problem/solution を使っていないが、LLM呼び出し時に影響

#### `/lib/gemini/client.ts`
- **行151-154**: similarResponses のテキスト参照を修正
  ```typescript
  // 旧
  問題把握の回答: ${r.answer_q1 || '（なし）'}
  対策立案の回答: ${r.answer_q2 || '（なし）'}

  // 新
  設問1の回答: ${r.answer_q1 || '（なし）'}
  設問2の回答: ${[r.answer_q2, r.answer_q3, ...].filter(Boolean).join('\n') || '（なし）'}
  ```

### 6. クエリ関数

#### `/lib/supabase/queries.ts`
- **行487**: onConflict の question カラム対応
- **行500, 516**: 型定義を `'q1' | 'q2'` に変更
- **行523**: markEmbeddingJobs のパラメータ型
- **行552, 569**: fetchResponsesForEmbeddingJobs
  - answer_q1〜q8 全て取得するように修正
- **行666, 684**: fetchEmbeddingsForBucket
- **行643, 652**: getTypicalExamples
- **行622, 633**: deleteTypicalExamplesForBucket
- **行595**: upsertResponseEmbeddings
- **行612**: upsertTypicalExamples

### 7. UI コンポーネント

#### `/app/dashboard/score-predict/ScorePredictClient.tsx`
- **行28-29**: 状態変数名を変更（任意）
  ```typescript
  // 旧
  const [problemAnswer, setProblemAnswer] = useState("");
  const [solutionAnswer, setSolutionAnswer] = useState("");

  // 新
  const [q1Answer, setQ1Answer] = useState("");
  const [q2Answer, setQ2Answer] = useState("");
  ```
- **行35-36, 55-59**: question パラメータを `'q1' | 'q2'` に

#### `/app/dashboard/predict/PredictClient.tsx`
- **行28**: Accordion キーを変更
- **行203-303**: セクションラベルを「設問1」「設問2」に変更
- `problemAnswer` → `q1Answer` 等の名称変更（任意）

### 8. 型定義

#### `/types/index.ts`
- **行58-64**: PredictionResponse の修正
  ```typescript
  // 旧
  problemAnswer: string;
  solutionAnswer: string;

  // 新（または両方維持して互換性確保）
  q1Answer: string;
  q2Answer: string;
  ```
- **行68**: TypicalExample 型の question フィールド

### 9. 事前準備API

#### `/app/api/admin/prepare/typical/route.ts`
- **行11-12**: リクエストボディの question 型
#### `/actions/prepare.ts`
- **行28**: 関数パラメータの question 型

---

## DBマイグレーション

既存データの移行が必要:

```sql
-- embedding_queue
UPDATE embedding_queue SET question = 'q1' WHERE question = 'problem';
UPDATE embedding_queue SET question = 'q2' WHERE question = 'solution';

-- response_embeddings
UPDATE response_embeddings SET question = 'q1' WHERE question = 'problem';
UPDATE response_embeddings SET question = 'q2' WHERE question = 'solution';

-- typical_examples
UPDATE typical_examples SET question = 'q1' WHERE question = 'problem';
UPDATE typical_examples SET question = 'q2' WHERE question = 'solution';
```

また、q2 のembeddingは answer_q2〜q8 を結合した新しいテキストで再生成が必要。

---

## 重要な検討事項

### 1. スコアとの紐付け

現状: `q1 → score_problem`, `q2 → score_solution` としてスコアを取得

問題: 設問1/設問2 と 問題把握/対策立案 は直接対応しない

選択肢:
- **案A**: スコアの紐付けをやめ、全体スコア（score_overall）のみ使う
- **案B**: 新しい評価軸（score_q1, score_q2）を追加
- **案C**: 現状維持（設問と評価軸の不一致を許容）

### 2. 後方互換性

- APIレスポンスの `problemAnswer` / `solutionAnswer` を維持するか
- 新旧両方のキーを返す移行期間を設けるか

---

## 作業順序（推奨）

### フェーズ1: 設問管理機能の追加（新機能）

1. **DBマイグレーション**: `questions` テーブル作成
2. **型定義追加**: `types/database.ts`, `types/index.ts`
3. **クエリ関数追加**: `lib/supabase/queries.ts`
4. **Server Actions追加**: `actions/questions.ts`
5. **管理者UI作成**: `app/admin/questions/`
6. **サイドバー更新**: `components/layout/Sidebar.tsx`

### フェーズ2: Embeddingラベル修正（既存機能の修正）

7. **型定義の修正**: `'problem' | 'solution'` → `'q1' | 'q2'`
8. **DBマイグレーション**: 既存データのラベル変更
9. **DB関数の修正**: `DATABASE_FUNCTION.sql`
10. **クエリ関数の修正**: `lib/supabase/queries.ts`
11. **Worker処理の修正**: `lib/prepare/worker.ts`（q2はq2〜q8結合）
12. **アップロード処理の修正**: `app/api/admin/upload/route.ts`

### フェーズ3: 予測処理・UIの修正

13. **スコア予測処理の修正**: `lib/scoring.ts`, `actions/predictScore.ts`
14. **回答予測処理の修正**: `lib/gemini/client.ts`, `actions/predict.ts`
15. **UIの修正**: `ScorePredictClient.tsx`, `PredictClient.tsx`
16. **LLMプロンプトに設問テキストを含める**

### フェーズ4: データ再生成

17. **既存データの再embedding生成**（q2はq2〜q8結合版で再生成）
18. **典型例の再生成**

---

## 影響範囲まとめ

| カテゴリ | ファイル数 | 修正箇所数（概算） |
|----------|------------|-------------------|
| 型定義 | 2 | 15+ |
| DB関数・マイグレーション | 2 | 10 |
| クエリ関数 | 1 | 20+ |
| Worker | 1 | 10 |
| Server Actions | 5 | 20 |
| API Routes | 2 | 5 |
| UI Components（既存修正） | 2 | 20 |
| UI Components（新規追加） | 2 | 新規 |
| **合計** | **17** | **100+** |

---

## 新規作成ファイル一覧

| ファイルパス | 用途 |
|-------------|------|
| `/app/admin/questions/page.tsx` | 設問管理ページ |
| `/app/admin/questions/QuestionsClient.tsx` | 設問管理クライアント |
| `/actions/questions.ts` | 設問関連Server Actions |
