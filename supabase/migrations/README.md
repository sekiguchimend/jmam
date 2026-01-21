# Supabase マイグレーション: 詳細スコア対応

## 概要
予測スコアで詳細スコア（全21項目）を表示するために、Supabaseのデータベース関数を更新します。

## 必要な作業

以下の2つのSQL関数を更新する必要があります:
1. `find_similar_responses_for_scoring` - 同一ケース内の類似回答検索
2. `find_similar_responses_cross_cases` - 複数ケース間の類似回答検索

## 適用方法

### オプション1: Supabase CLI使用

```bash
cd front
supabase db push
```

### オプション2: Supabaseダッシュボードから手動適用

1. [Supabase Dashboard](https://app.supabase.com/) にログイン
2. プロジェクトを選択
3. 左メニューから「SQL Editor」を選択
4. 以下の順序でSQLファイルの内容を実行:
   - `update_find_similar_responses_for_scoring.sql`
   - `update_find_similar_responses_cross_cases.sql`

## 変更内容

### 追加された返り値フィールド

**主要スコア（7項目）**:
- `score_overall`
- `score_problem`
- `score_solution`
- `score_role`
- `score_leadership`
- `score_collaboration`
- `score_development`

**問題把握の詳細スコア（6項目）**:
- `detail_problem_understanding`
- `detail_problem_essence`
- `detail_problem_maintenance_biz`
- `detail_problem_maintenance_hr`
- `detail_problem_reform_biz`
- `detail_problem_reform_hr`

**対策立案の詳細スコア（6項目）**:
- `detail_solution_coverage`
- `detail_solution_planning`
- `detail_solution_maintenance_biz`
- `detail_solution_maintenance_hr`
- `detail_solution_reform_biz`
- `detail_solution_reform_hr`

**連携の詳細スコア（3項目）**:
- `detail_collab_supervisor`
- `detail_collab_external`
- `detail_collab_member`

## 確認方法

マイグレーション適用後、以下を確認してください:

1. アプリケーションをリビルド: `npm run build`
2. スコア予測ページで回答を入力
3. 予測結果に「詳細スコア」セクションが表示されることを確認
4. 問題把握、対策立案、連携の詳細スコアが表示されることを確認

## トラブルシューティング

### 詳細スコアが表示されない場合

1. Supabaseダッシュボードで関数が正しく更新されているか確認
2. ブラウザのキャッシュをクリア
3. アプリケーションを再起動

### エラーが発生する場合

既存の関数を削除してから再作成:

```sql
DROP FUNCTION IF EXISTS find_similar_responses_for_scoring(text, text, text, integer);
DROP FUNCTION IF EXISTS find_similar_responses_cross_cases(text, text[], text, integer);
```

その後、新しいSQL関数を実行してください。
