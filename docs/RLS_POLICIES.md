# Supabase RLS (Row Level Security) ポリシー一覧

## 概要

このドキュメントは、jmamプロジェクトの全テーブルのRLSポリシーをまとめたものです。
anon keyとservice_role keyの使い分けの判断材料として使用してください。

## RLS状態サマリー

| テーブル名 | RLS有効 | 公開SELECT | 認証必須 | 備考 |
|-----------|---------|-----------|---------|------|
| admin_users | ✅ | ❌ | ✅ | 管理者専用 |
| cases | ✅ | ❌ | ✅ | 認証ユーザーのみ読み取り可 |
| embedding_queue | ✅ | ❌ | ✅ | 管理者専用 |
| prediction_history | ✅ | ❌ | ✅ | 自分のデータのみ |
| profiles | ✅ | ❌ | ✅ | 自分のプロファイルのみ |
| questions | ✅ | ❌ | ✅ | 認証ユーザーのみ読み取り可 |
| response_embeddings | ✅ | ❌ | ✅ | 認証ユーザーのみ読み取り可 |
| responses | ✅ | ❌ | ✅ | 認証ユーザーのみ読み取り可 |
| score_distribution | ✅ | ❌ | ✅ | 認証ユーザーのみ |
| score_prototypes | ✅ | ❌ | ✅ | 認証ユーザーのみ |
| typical_examples | ✅ | ❌ | ✅ | 認証ユーザーのみ読み取り可 |
| upload_jobs | ✅ | ❌ | ✅ | 管理者専用 |
| upload_logs | ❌ | - | - | RLS無効（要確認） |
| user_blocks | ✅ | ❌ | ✅ | 管理者専用 |
| user_score_records | ✅ | ❌ | ✅ | 自分のデータのみ |

---

## 詳細ポリシー一覧

### 1. admin_users

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| admin_users_delete_policy | DELETE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| admin_users_insert_policy | INSERT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| admin_users_select_policy | SELECT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| admin_users_update_policy | UPDATE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**: `supabaseServiceRole` または 管理者JWT付き `createAuthedAnonServerClient`

---

### 2. cases

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| cases_delete_policy | DELETE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| cases_insert_policy | INSERT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| cases_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |
| cases_update_policy | UPDATE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 3. embedding_queue

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| embedding_queue_all_policy | ALL | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**: `supabaseServiceRole` または 管理者JWT付き `createAuthedAnonServerClient`

---

### 4. prediction_history

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| prediction_history_delete_policy | DELETE | authenticated | `(auth.uid() = user_id)` |
| prediction_history_insert_policy | INSERT | authenticated | `(auth.uid() = user_id)` |
| prediction_history_select_policy | SELECT | authenticated | `(auth.uid() = user_id)` |
| prediction_history_update_policy | UPDATE | authenticated | `(auth.uid() = user_id)` |

**使用するクライアント**: `createAuthedAnonServerClient(accessToken)` (ユーザーのJWT必須)

---

### 5. profiles

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| profiles_insert_policy | INSERT | authenticated | `(auth.uid() = id)` |
| profiles_select_policy | SELECT | authenticated | `(auth.uid() = id)` |
| profiles_update_policy | UPDATE | authenticated | `(auth.uid() = id)` |

**使用するクライアント**: `createAuthedAnonServerClient(accessToken)` (ユーザーのJWT必須)

---

### 6. questions

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| questions_delete_policy | DELETE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| questions_insert_policy | INSERT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| questions_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |
| questions_update_policy | UPDATE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 7. response_embeddings

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| response_embeddings_delete_policy | DELETE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| response_embeddings_insert_policy | INSERT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| response_embeddings_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |
| response_embeddings_update_policy | UPDATE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 8. responses

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| responses_delete_policy | DELETE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| responses_insert_policy | INSERT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| responses_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |
| responses_update_policy | UPDATE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 9. score_distribution

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| score_distribution_all_policy | ALL | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| score_distribution_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 10. score_prototypes

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| score_prototypes_all_policy | ALL | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| score_prototypes_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 11. typical_examples

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| typical_examples_delete_policy | DELETE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| typical_examples_insert_policy | INSERT | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |
| typical_examples_select_policy | SELECT | authenticated | `true` (認証済みなら無条件) |
| typical_examples_update_policy | UPDATE | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**:
- SELECT: `createAuthedAnonServerClient(accessToken)` (認証済みユーザー)
- INSERT/UPDATE/DELETE: `supabaseServiceRole` または 管理者JWT

---

### 12. upload_jobs

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| upload_jobs_all_policy | ALL | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**: `supabaseServiceRole` または 管理者JWT付き `createAuthedAnonServerClient`

---

### 13. upload_logs

**RLS: 無効**

⚠️ **注意**: このテーブルはRLSが無効です。セキュリティ上の問題がないか確認が必要です。

**使用するクライアント**: どのクライアントでもアクセス可能（RLSが無効のため）

---

### 14. user_blocks

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| user_blocks_all_policy | ALL | authenticated | `(auth.jwt() ->> 'role'::text) = 'admin'::text` |

**使用するクライアント**: `supabaseServiceRole` または 管理者JWT付き `createAuthedAnonServerClient`

---

### 15. user_score_records

**RLS: 有効**

| ポリシー名 | 操作 | ロール | 条件 |
|-----------|------|-------|------|
| user_score_records_delete_policy | DELETE | authenticated | `(auth.uid() = user_id)` |
| user_score_records_insert_policy | INSERT | authenticated | `(auth.uid() = user_id)` |
| user_score_records_select_policy | SELECT | authenticated | `(auth.uid() = user_id)` |
| user_score_records_update_policy | UPDATE | authenticated | `(auth.uid() = user_id)` |

**使用するクライアント**: `createAuthedAnonServerClient(accessToken)` (ユーザーのJWT必須)

---

## クライアント使い分けガイド

### 1. `createAuthedAnonServerClient(accessToken)` (anon key + JWT)
**用途**: 認証ユーザーの操作（全テーブルの読み取り）
- cases (SELECT) - 認証済みなら誰でも
- responses (SELECT) - 認証済みなら誰でも
- response_embeddings (SELECT) - 認証済みなら誰でも
- typical_examples (SELECT) - 認証済みなら誰でも
- prediction_history (全操作) - 自分のデータのみ
- profiles (全操作) - 自分のプロファイルのみ
- questions (SELECT) - 認証済みなら誰でも
- score_distribution (SELECT) - 認証済みなら誰でも
- score_prototypes (SELECT) - 認証済みなら誰でも
- user_score_records (全操作) - 自分のデータのみ

### 2. `supabaseServiceRole` (service_role key)
**用途**: 管理者操作、バッチ処理、RLSをバイパスする必要がある操作
- admin_users (全操作)
- embedding_queue (全操作)
- upload_jobs (全操作)
- user_blocks (全操作)
- cases (INSERT/UPDATE/DELETE)
- responses (INSERT/UPDATE/DELETE)
- response_embeddings (INSERT/UPDATE/DELETE)
- typical_examples (INSERT/UPDATE/DELETE)
- questions (INSERT/UPDATE/DELETE)
- score_distribution (INSERT/UPDATE/DELETE)
- score_prototypes (INSERT/UPDATE/DELETE)

**注**: `createSupabaseAnonServerClient()` (anon key のみ) は公開データの読み取りに使用できましたが、セキュリティ強化により全テーブルの読み取りに認証が必要になりました。

---

## 実装完了済みの修正

### queries.ts

- **認証必須SELECT関数** → `createAuthedAnonServerClient(accessToken)` を使用
  - `getCases()`, `getCaseById()`, `findSimilarResponses()`, `fetchSampleResponsesFromOtherCases()`
  - `findSimilarResponsesByEuclidean()`, `findSimilarResponsesWithFallback()`, `findResponsesForRAG()`
  - `getDatasetStats()`, `getTotalResponseCount()`, `getTypicalExamples()`, `fetchEmbeddingsForBucket()`
  - `getQuestionsByCase()`

- **管理者操作** → `createAuthedAnonServerClient(accessToken)` または `supabaseServiceRole` を使用

### auth.ts

- **ログイン時の管理者チェック** → `supabaseServiceRole` を使用（ログイン中のユーザーは管理者JWTを持っていないため）
- **初期セットアップでの管理者作成** → `supabaseServiceRole` を使用

### app/admin/setup/page.tsx

- **管理者存在チェック** → `supabaseServiceRole` を使用

### lib/prepare/worker.ts

- **responses の取得** → `createAuthedAnonServerClient(adminToken)` を使用（認証必須）

---

*最終更新: 2026-04-12*
