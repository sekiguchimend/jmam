# Prototypical Networks スコア予測の設定と使い方

## 概要

Prototypical Networksを使ったスコア予測機能を実装しました。この手法により、データ量の偏りによる予測精度の問題を解決します。

### 解決する問題

- **従来の問題**: スコア4.5の回答が100件、スコア2.0の回答が5件の場合、逆頻度重みにより少数派が過剰に重視される
- **解決策**: 各スコア帯を「1つのプロトタイプ（代表ベクトル）」で表現し、データ量に依存しない予測を実現

## セットアップ手順

### 1. データベース関数とテーブルの作成

`DATABASE_FUNCTION.sql` に追加された関数を Supabase のダッシュボードで実行してください：

```sql
-- スコアプロトタイプテーブルを作成
CREATE TABLE IF NOT EXISTS score_prototypes (
  case_id TEXT NOT NULL,
  question TEXT NOT NULL,
  score_field TEXT NOT NULL,
  score_bucket NUMERIC NOT NULL,
  prototype_embedding vector(3072),
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (case_id, question, score_field, score_bucket)
);

-- 以下、update_score_prototypes などの関数も実行
```

### 2. プロトタイプの事前計算

既存のケースデータから、各スコア帯のプロトタイプベクトルを計算します：

```sql
-- 全ケースのプロトタイプを一括更新
SELECT update_all_score_prototypes();

-- または特定のケースのみ
SELECT update_score_prototypes('your-case-id', 'q1');
SELECT update_score_prototypes('your-case-id', 'q2');
```

**注意**: 新しいケースデータが追加されたら、定期的にプロトタイプを再計算してください。

### 3. 確認

プロトタイプが正しく作成されたか確認：

```sql
SELECT case_id, question, score_field, score_bucket, sample_count
FROM score_prototypes
ORDER BY case_id, question, score_field, score_bucket;
```

## アルゴリズムの仕組み

### 1. プロトタイプの計算（事前処理）

各スコア帯（0.5刻み: 0.0, 0.5, 1.0, ..., 5.0）ごとに：
- そのスコアを持つ全回答のエンベディングベクトルを取得
- それらの平均ベクトルを計算 → **プロトタイプベクトル**
- データベースに保存

**例**:
- スコア4.5の回答が100件 → 100個のベクトルの平均 = プロトタイプ4.5
- スコア2.0の回答が5件 → 5個のベクトルの平均 = プロトタイプ2.0
- **どちらも「1つのベクトル」として扱われる**

### 2. 予測時の処理（ユーザー回答入力時）

1. **プロトタイプベースの予測**:
   - ユーザーの回答をエンベディング化
   - 各プロトタイプとのコサイン類似度を計算
   - Softmax（温度パラメータ付き）で確率分布に変換
   - 重み付き平均でスコアを予測

2. **個別類似回答ベースの予測**:
   - 従来通り、類似度の高い個別回答から予測

3. **ハイブリッド**:
   - プロトタイプ予測（60%）+ 個別回答予測（40%）で最終スコアを算出

## 設定のカスタマイズ

`lib/scoring.ts` の `PROTOTYPE_CONFIG` で調整可能：

```typescript
const PROTOTYPE_CONFIG = {
  usePrototypes: true,              // プロトタイプ使用のON/OFF
  prototypeWeight: 0.6,             // プロトタイプ予測の重み（0.6 = 60%）
  individualWeight: 0.4,            // 個別回答予測の重み（0.4 = 40%）
  minPrototypeSimilarity: 0.4,      // プロトタイプとの最低類似度閾値
  temperatureScaling: 2.0,          // Softmax温度（低いほど最高類似度を強調）
};
```

### パラメータの意味

- **prototypeWeight / individualWeight**:
  - プロトタイプを信頼する場合は 0.7/0.3 など
  - 個別回答を重視する場合は 0.4/0.6 など

- **minPrototypeSimilarity**:
  - 低すぎる類似度のプロトタイプを除外（推奨: 0.3〜0.5）

- **temperatureScaling**:
  - 低い（1.0以下）: 最も類似したプロトタイプを強く重視
  - 高い（2.0以上）: 複数のプロトタイプをより均等に考慮

## メリット

1. **データ量の偏りに強い**: 5件しかないスコア帯も、100件あるスコア帯も公平に扱える
2. **計算効率が良い**: プロトタイプは事前計算済みなので、予測時は高速
3. **Few-shot Learningに対応**: データが少ないスコア帯でも、プロトタイプがあれば予測可能
4. **解釈性が高い**: どのスコア帯のプロトタイプに近いか明確

## 運用上の注意

1. **データ更新時**:
   - 新しい回答データを追加したら、必ず `update_score_prototypes()` を実行
   - バッチ処理で定期的（例: 日次）に更新するのを推奨

2. **初期データが少ない場合**:
   - 各スコア帯に最低3〜5件の回答がないと、プロトタイプが不安定
   - データが少ない初期は `usePrototypes: false` にして従来手法を使うことも可能

3. **モニタリング**:
   - `score_prototypes` テーブルの `sample_count` を定期的に確認
   - 極端に少ない（1〜2件）スコア帯は要注意

## トラブルシューティング

### プロトタイプが生成されない

```sql
-- エンベディングデータの存在確認
SELECT COUNT(*) FROM response_embeddings WHERE embedding IS NOT NULL;

-- スコアデータの存在確認
SELECT COUNT(*) FROM responses WHERE score_overall IS NOT NULL;
```

### 予測が従来と大きく変わった

- `PROTOTYPE_CONFIG.prototypeWeight` を 0.3〜0.4 に下げて様子を見る
- または `usePrototypes: false` で従来手法に戻す

### パフォーマンスが遅い

- プロトタイプテーブルにインデックスが正しく作成されているか確認
- `predict_score_with_prototypes` 関数の実行計画を確認
