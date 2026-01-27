# スコア計算ロジック

## 概要

本ドキュメントでは、詳細スコア（子スコア）から主要スコア（親スコア）を計算するロジックを説明します。

**重要**: 本システムでは、以下の流れでスコアを予測します：

1. **詳細スコア（15項目）**: エンベディング類似度から予測
2. **主要スコア（problem, solution, collaboration）**: 詳細スコアから計算式で導出
3. **主要スコア（role, leadership, development）**: AI予測または推定値を使用

データ分析に基づき、以下の3つの親スコアについて計算式を特定しました。

| 親スコア | 子スコア数 | 計算式の一致率 | ルックアップ一致率 |
|---------|-----------|---------------|------------------|
| 問題把握 (score_problem) | 6個 | 76.5% | 92.7% |
| 対策立案 (score_solution) | 6個 | 73.2% | 94.7% |
| 連携 (score_collaboration) | 3個 | 90.3% | 91.6% |

---

## 1. 連携 (score_collaboration)

### 子スコア
- `detail_collab_supervisor` : 上司との連携（1-4）
- `detail_collab_external` : 職場外との連携（1-4）
- `detail_collab_member` : メンバーとの連携（1-4）

### 計算式
```
score_collaboration = (上司 + 職場外 + メンバー) ÷ 2 - 0.5
```

### 制約
- 最小値: 1.0
- 最大値: 4.0
- 刻み: 0.5

### TypeScript実装
```typescript
function calculateCollaboration(
  supervisor: number,  // 1-4
  external: number,    // 1-4
  member: number       // 1-4
): number {
  const sum = supervisor + external + member;
  const raw = sum / 2 - 0.5;
  // 範囲制限と0.5刻みに丸め
  return Math.max(1, Math.min(4, Math.round(raw * 2) / 2));
}
```

### 計算例
| 上司 | 職場外 | メンバー | 合計 | 計算 | 結果 |
|-----|-------|---------|-----|------|------|
| 2 | 2 | 2 | 6 | 6÷2-0.5 = 2.5 | **2.5** |
| 3 | 3 | 3 | 9 | 9÷2-0.5 = 4.0 | **4.0** |
| 1 | 1 | 1 | 3 | 3÷2-0.5 = 1.0 | **1.0** |
| 2 | 3 | 2 | 7 | 7÷2-0.5 = 3.0 | **3.0** |

---

## 2. 問題把握 (score_problem)

### 子スコア
- `detail_problem_understanding` : 問題の理解（1-4）
- `detail_problem_essence` : 本質の把握（1-4）
- `detail_problem_maintenance_biz` : 維持管理・業務（1-4）
- `detail_problem_maintenance_hr` : 維持管理・人（1-4）
- `detail_problem_reform_biz` : 改革・業務（1-4）
- `detail_problem_reform_hr` : 改革・人（1-4）

### 計算式
```
基本値 = (6項目の合計 ÷ 6 ÷ 4) × 5

丸め方:
  IF 理解 >= 3 AND 本質 < 理解 THEN
    切り捨て（0.5刻み）
  ELSE
    四捨五入（0.5刻み）
```

### 制約
- 最小値: 1.0
- 最大値: 5.0
- 刻み: 0.5

### TypeScript実装
```typescript
function calculateProblem(
  understanding: number,    // 理解 (1-4)
  essence: number,          // 本質 (1-4)
  maintBiz: number,         // 維持管理・業務 (1-4)
  maintHr: number,          // 維持管理・人 (1-4)
  reformBiz: number,        // 改革・業務 (1-4)
  reformHr: number          // 改革・人 (1-4)
): number {
  const sum = understanding + essence + maintBiz + maintHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;

  // 条件判定: 理解>=3 かつ 本質<理解 → 切り捨て
  if (understanding >= 3 && essence < understanding) {
    return Math.floor(raw / 0.5) * 0.5;
  }
  // それ以外 → 四捨五入
  return Math.round(raw / 0.5) * 0.5;
}
```

### 計算例
| 理解 | 本質 | 維持業 | 維持人 | 改革業 | 改革人 | 合計 | raw | 条件 | 結果 |
|-----|-----|-------|-------|-------|-------|-----|-----|-----|------|
| 2 | 2 | 2 | 2 | 2 | 2 | 12 | 2.50 | 四捨五入 | **2.5** |
| 3 | 2 | 2 | 2 | 2 | 2 | 13 | 2.71 | 切り捨て | **2.5** |
| 3 | 3 | 3 | 3 | 3 | 3 | 18 | 3.75 | 四捨五入 | **4.0** |
| 4 | 3 | 3 | 3 | 3 | 3 | 19 | 3.96 | 切り捨て | **3.5** |

### 条件の意味
「理解は高いが本質を捉えていない」場合、評価を厳しく（切り捨て）する。

---

## 3. 対策立案 (score_solution)

### 子スコア
- `detail_solution_coverage` : 網羅性（1-4）
- `detail_solution_planning` : 計画性（1-4）
- `detail_solution_maintenance_biz` : 維持管理・業務（1-4）
- `detail_solution_maintenance_hr` : 維持管理・人（1-4）
- `detail_solution_reform_biz` : 改革・業務（1-4）
- `detail_solution_reform_hr` : 改革・人（1-4）

### 計算式
```
基本値 = (6項目の合計 ÷ 6 ÷ 4) × 5

丸め方:
  IF 網羅性 >= 3 AND 計画性 <= 2 THEN
    切り捨て（0.5刻み）
  ELSE
    四捨五入（0.5刻み）
```

### 制約
- 最小値: 1.0
- 最大値: 5.0
- 刻み: 0.5

### TypeScript実装
```typescript
function calculateSolution(
  coverage: number,     // 網羅性 (1-4)
  planning: number,     // 計画性 (1-4)
  maintBiz: number,     // 維持管理・業務 (1-4)
  maintHr: number,      // 維持管理・人 (1-4)
  reformBiz: number,    // 改革・業務 (1-4)
  reformHr: number      // 改革・人 (1-4)
): number {
  const sum = coverage + planning + maintBiz + maintHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;

  // 条件判定: 網羅性>=3 かつ 計画性<=2 → 切り捨て
  if (coverage >= 3 && planning <= 2) {
    return Math.floor(raw / 0.5) * 0.5;
  }
  // それ以外 → 四捨五入
  return Math.round(raw / 0.5) * 0.5;
}
```

### 計算例
| 網羅 | 計画 | 維持業 | 維持人 | 改革業 | 改革人 | 合計 | raw | 条件 | 結果 |
|-----|-----|-------|-------|-------|-------|-----|-----|-----|------|
| 2 | 2 | 2 | 2 | 2 | 2 | 12 | 2.50 | 四捨五入 | **2.5** |
| 3 | 2 | 2 | 2 | 2 | 2 | 13 | 2.71 | 切り捨て | **2.5** |
| 3 | 3 | 3 | 3 | 3 | 3 | 18 | 3.75 | 四捨五入 | **4.0** |
| 4 | 2 | 3 | 3 | 3 | 3 | 18 | 3.75 | 切り捨て | **3.5** |

### 条件の意味
「網羅的だが計画性が低い」場合、評価を厳しく（切り捨て）する。

---

## 4. 子スコアを持たない親スコア

以下の親スコアには直接の子スコアがなく、他の親スコアから計算されると推測されます。

### 役割理解 (score_role)
```
score_role ≒ (連携 + 主導) ÷ 2
```
一致率: 約43.6%（低い）

### 主導 (score_leadership)
```
score_leadership ≒ 対策立案スコア
```
一致率: 約47.0%（低い）

### 育成 (score_development)
```
score_development ≒ 対策立案の維持管理・人 + 0.5
```
一致率: 約54.2%（低い）

**注意**: これらのスコアは単純な計算式では再現できず、他の要因が影響している可能性があります。

---

## 5. 一致率の限界について

### データの矛盾
同じ子スコアの組み合わせでも、異なる親スコアが付与されているケースがあります。

| 親スコア | 矛盾データ数 | 理論上の最大一致率 |
|---------|------------|------------------|
| 問題把握 | 21件 | 92.7% |
| 対策立案 | 17件 | 94.7% |
| 連携 | 27件 | 91.6% |

これは以下の理由が考えられます:
1. 評価者による主観的な調整
2. 記述内容など、子スコア以外の要因
3. データ入力時の誤差

### ルックアップテーブル方式
計算式よりも高い一致率を達成するには、過去データからルックアップテーブルを作成し、同じ子スコアパターンには最頻値を返す方法があります。

```typescript
// ルックアップテーブルの例
const PROBLEM_LOOKUP: Record<string, number> = {
  "1,1,1,1,1,1": 1.5,
  "2,2,2,2,2,2": 2.5,
  "3,3,3,3,3,3": 4.0,
  // ... 全パターン
};

function calculateProblemWithLookup(
  understanding: number,
  essence: number,
  maintBiz: number,
  maintHr: number,
  reformBiz: number,
  reformHr: number
): number {
  const key = `${understanding},${essence},${maintBiz},${maintHr},${reformBiz},${reformHr}`;

  // ルックアップテーブルにあればそれを返す
  if (key in PROBLEM_LOOKUP) {
    return PROBLEM_LOOKUP[key];
  }

  // なければ計算式で計算
  const sum = understanding + essence + maintBiz + maintHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;
  if (understanding >= 3 && essence < understanding) {
    return Math.floor(raw / 0.5) * 0.5;
  }
  return Math.round(raw / 0.5) * 0.5;
}
```

---

## 6. まとめ

### 確実に計算可能なスコア
| スコア | 計算式の信頼度 |
|-------|--------------|
| 連携 | **高** (90.3%) |
| 問題把握 | **中〜高** (76.5〜92.7%) |
| 対策立案 | **中〜高** (73.2〜94.7%) |

### 計算式が不明確なスコア
| スコア | 備考 |
|-------|------|
| 役割理解 | 他の親スコアから派生 |
| 主導 | 対策立案と相関あり |
| 育成 | 対策立案の一部と相関あり |

---

## 付録: 完全なTypeScript実装

```typescript
// スコア計算ユーティリティ

export function calculateCollaboration(
  supervisor: number,
  external: number,
  member: number
): number {
  const sum = supervisor + external + member;
  const raw = sum / 2 - 0.5;
  return Math.max(1, Math.min(4, Math.round(raw * 2) / 2));
}

export function calculateProblem(
  understanding: number,
  essence: number,
  maintBiz: number,
  maintHr: number,
  reformBiz: number,
  reformHr: number
): number {
  const sum = understanding + essence + maintBiz + maintHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;

  if (understanding >= 3 && essence < understanding) {
    return Math.floor(raw / 0.5) * 0.5;
  }
  return Math.round(raw / 0.5) * 0.5;
}

export function calculateSolution(
  coverage: number,
  planning: number,
  maintBiz: number,
  maintHr: number,
  reformBiz: number,
  reformHr: number
): number {
  const sum = coverage + planning + maintBiz + maintHr + reformBiz + reformHr;
  const raw = (sum / 6 / 4) * 5;

  if (coverage >= 3 && planning <= 2) {
    return Math.floor(raw / 0.5) * 0.5;
  }
  return Math.round(raw / 0.5) * 0.5;
}
```

---

## 7. システム実装詳細

### 実装ファイル

- `lib/score-calculation.ts` - スコア計算関数の実装
- `lib/scoring.ts` - スコア予測のメインロジック（上記計算関数を使用）

### 予測フロー

```
1. ユーザーが回答を入力
        ↓
2. 回答をEmbedding化
        ↓
3. 類似回答を検索（Supabase Vector Search）
        ↓
4. 詳細スコア（15項目）を予測
   - エンベディング類似度に基づく重み付き平均
        ↓
5. 主要スコアを計算
   - problem: calculateProblemScore()で計算
   - solution: calculateSolutionScore()で計算
   - collaboration: calculateCollaborationScore()で計算
   - role: AI予測 or 推定 (collaboration + leadership) / 2
   - leadership: AI予測 or 推定 (solution)
   - development: AI予測 or 推定 (solutionMaintenanceHr + 0.5)
        ↓
6. 結果を返す
```

### 設問による違い

| 設問 | 計算されるスコア |
|------|-----------------|
| Q1（問題把握） | problem, role |
| Q2（対策立案） | solution, role, leadership, collaboration, development |

### AIの役割

現在のシステムでは、AIは以下の役割を担います：

1. **回答の妥当性チェック** - 無効な回答を検出
2. **role/leadership/developmentの予測** - 詳細スコアがないため、AIが直接予測
3. **説明文の生成** - 評価の理由を説明

**problem/solution/collaborationはAIが予測せず、詳細スコアから計算式で導出されます。**
