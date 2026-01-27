// ルックアップテーブルの生成と最終計算式の導出
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function generateLookupTable() {
  console.log('=== 子スコア → 親スコア 計算ロジック 最終版 ===\n');

  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) {
    console.error('Error:', error);
    return;
  }

  console.log(`総データ数: ${data.length}\n`);

  // =============================================
  // 1. 問題把握のルックアップテーブル
  // =============================================
  console.log('='.repeat(80));
  console.log('【1. 問題把握 (score_problem)】');
  console.log('='.repeat(80));
  console.log('子スコア: understanding, essence, maintenance_biz, maintenance_hr, reform_biz, reform_hr');
  console.log('各子スコア: 1〜4の整数');
  console.log('親スコア: 1.5〜5.0（0.5刻み）\n');

  const problemChildren = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  const problemTable = generateTable(data, 'score_problem', problemChildren);
  printLookupTable('問題把握', problemTable, 6);

  // =============================================
  // 2. 対策立案のルックアップテーブル
  // =============================================
  console.log('\n' + '='.repeat(80));
  console.log('【2. 対策立案 (score_solution)】');
  console.log('='.repeat(80));
  console.log('子スコア: coverage, planning, maintenance_biz, maintenance_hr, reform_biz, reform_hr');
  console.log('各子スコア: 1〜4の整数');
  console.log('親スコア: 1.5〜5.0（0.5刻み）\n');

  const solutionChildren = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];

  const solutionTable = generateTable(data, 'score_solution', solutionChildren);
  printLookupTable('対策立案', solutionTable, 6);

  // =============================================
  // 3. 連携のルックアップテーブル
  // =============================================
  console.log('\n' + '='.repeat(80));
  console.log('【3. 連携 (score_collaboration)】');
  console.log('='.repeat(80));
  console.log('子スコア: supervisor(上司), external(職場外), member(メンバー)');
  console.log('各子スコア: 1〜4の整数');
  console.log('親スコア: 1.5〜4.0（0.5刻み）\n');

  const collabChildren = [
    'detail_collab_supervisor',
    'detail_collab_external',
    'detail_collab_member'
  ];

  const collabTable = generateTable(data, 'score_collaboration', collabChildren);
  printLookupTable('連携', collabTable, 3);

  // =============================================
  // 4〜6. 役割理解・主導・育成の計算式
  // =============================================
  console.log('\n' + '='.repeat(80));
  console.log('【4〜6. 役割理解・主導・育成】');
  console.log('='.repeat(80));

  deriveIndependentFormulas(data);

  // =============================================
  // 最終的な計算コード生成
  // =============================================
  console.log('\n' + '='.repeat(80));
  console.log('【最終：TypeScript計算コード】');
  console.log('='.repeat(80));

  generateTypeScriptCode(problemTable, solutionTable, collabTable);
}

function generateTable(
  data: any[],
  parentField: string,
  childFields: string[]
): Map<number, number> {
  const valid = data.filter(d =>
    d[parentField] != null &&
    childFields.every(cf => d[cf] != null)
  );

  const bySum = new Map<number, Map<number, number>>();

  for (const d of valid) {
    const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
    const parent = d[parentField];

    if (!bySum.has(sum)) {
      bySum.set(sum, new Map());
    }
    const parentDist = bySum.get(sum)!;
    parentDist.set(parent, (parentDist.get(parent) || 0) + 1);
  }

  const table = new Map<number, number>();

  for (const [sum, dist] of bySum.entries()) {
    let maxCount = 0;
    let mode = 0;
    for (const [parent, count] of dist.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mode = parent;
      }
    }
    table.set(sum, mode);
  }

  return table;
}

function printLookupTable(name: string, table: Map<number, number>, numChildren: number) {
  const minSum = numChildren * 1;  // 全部1の場合
  const maxSum = numChildren * 4;  // 全部4の場合

  console.log('ルックアップテーブル:');
  console.log('┌────────┬──────────┬─────────────────────────────┐');
  console.log('│ 子合計 │ 親スコア │ 備考                        │');
  console.log('├────────┼──────────┼─────────────────────────────┤');

  const sortedSums = Array.from(table.keys()).sort((a, b) => a - b);

  for (const sum of sortedSums) {
    const parent = table.get(sum)!;
    const avg = (sum / numChildren).toFixed(2);
    console.log(`│   ${sum.toString().padStart(2)}   │   ${parent.toFixed(1).padStart(4)}   │ 平均=${avg}                   │`);
  }

  console.log('└────────┴──────────┴─────────────────────────────┘');

  // 欠損している合計値を補完
  console.log('\n補完ルール（データがない合計値用）:');
  for (let sum = minSum; sum <= maxSum; sum++) {
    if (!table.has(sum)) {
      // 前後の値から推定
      const prev = table.get(sum - 1);
      const next = table.get(sum + 1);
      const estimated = prev !== undefined ? prev : (next !== undefined ? next : null);
      console.log(`  合計${sum}: データなし → ${estimated !== null ? estimated.toFixed(1) : '推定不可'} を推定`);
    }
  }
}

function deriveIndependentFormulas(data: any[]) {
  // 役割理解
  console.log('\n【役割理解 (score_role)】');
  console.log('計算式: (score_collaboration + score_leadership) / 2 を0.1刻みに丸め');
  console.log('一致率: 43.6%');
  console.log('注意: 完全一致は低いが、MAE=0.11と誤差は小さい');
  console.log('');

  // 実際のパターンを確認
  const roleValid = data.filter(d =>
    d.score_role != null &&
    d.score_collaboration != null &&
    d.score_leadership != null
  );

  const roleByInput = new Map<string, Map<number, number>>();
  for (const d of roleValid) {
    const key = `${d.score_collaboration}-${d.score_leadership}`;
    if (!roleByInput.has(key)) {
      roleByInput.set(key, new Map());
    }
    const roleDist = roleByInput.get(key)!;
    roleDist.set(d.score_role, (roleDist.get(d.score_role) || 0) + 1);
  }

  console.log('collaboration-leadership → role の対応（上位10パターン）:');
  const sortedPatterns = Array.from(roleByInput.entries())
    .map(([key, dist]) => {
      let maxCount = 0, mode = 0;
      for (const [role, count] of dist.entries()) {
        if (count > maxCount) { maxCount = count; mode = role; }
      }
      const total = Array.from(dist.values()).reduce((a, b) => a + b, 0);
      return { key, mode, total, dist };
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10);

  for (const p of sortedPatterns) {
    const [collab, leader] = p.key.split('-').map(Number);
    const expected = Math.round((collab + leader) / 2 * 10) / 10;
    const distStr = Array.from(p.dist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([r, c]) => `${r}(${c})`)
      .join(', ');
    console.log(`  ${p.key} → 最頻値=${p.mode}, 期待値=${expected}, 分布=[${distStr}]`);
  }

  // 主導
  console.log('\n【主導 (score_leadership)】');
  console.log('計算式: score_solution をそのまま使用（またはわずかな調整）');
  console.log('一致率: 47.0%');
  console.log('');

  const leaderValid = data.filter(d =>
    d.score_leadership != null &&
    d.score_solution != null
  );

  const leaderBySolution = new Map<number, Map<number, number>>();
  for (const d of leaderValid) {
    const sol = d.score_solution;
    if (!leaderBySolution.has(sol)) {
      leaderBySolution.set(sol, new Map());
    }
    const dist = leaderBySolution.get(sol)!;
    dist.set(d.score_leadership, (dist.get(d.score_leadership) || 0) + 1);
  }

  console.log('solution → leadership の対応:');
  const sortedSol = Array.from(leaderBySolution.keys()).sort((a, b) => a - b);
  for (const sol of sortedSol) {
    const dist = leaderBySolution.get(sol)!;
    let maxCount = 0, mode = 0;
    for (const [l, c] of dist.entries()) {
      if (c > maxCount) { maxCount = c; mode = l; }
    }
    const distStr = Array.from(dist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([l, c]) => `${l}(${c})`)
      .join(', ');
    console.log(`  solution=${sol} → leadership最頻値=${mode}, 分布=[${distStr}]`);
  }

  // 育成
  console.log('\n【育成 (score_development)】');
  console.log('計算式: detail_solution_maintenance_hr + 0.5 を0.5刻みに丸め（最大4.0）');
  console.log('一致率: 54.2%');
  console.log('');

  const devValid = data.filter(d =>
    d.score_development != null &&
    d.detail_solution_maintenance_hr != null
  );

  const devByHr = new Map<number, Map<number, number>>();
  for (const d of devValid) {
    const hr = d.detail_solution_maintenance_hr;
    if (!devByHr.has(hr)) {
      devByHr.set(hr, new Map());
    }
    const dist = devByHr.get(hr)!;
    dist.set(d.score_development, (dist.get(d.score_development) || 0) + 1);
  }

  console.log('solution_maintenance_hr → development の対応:');
  const sortedHr = Array.from(devByHr.keys()).sort((a, b) => a - b);
  for (const hr of sortedHr) {
    const dist = devByHr.get(hr)!;
    let maxCount = 0, mode = 0;
    for (const [d, c] of dist.entries()) {
      if (c > maxCount) { maxCount = c; mode = d; }
    }
    const expected = Math.min(4, Math.round((hr + 0.5) / 0.5) * 0.5);
    const distStr = Array.from(dist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([d, c]) => `${d}(${c})`)
      .join(', ');
    console.log(`  hr=${hr} → 最頻値=${mode}, 期待値=${expected}, 分布=[${distStr}]`);
  }
}

function generateTypeScriptCode(
  problemTable: Map<number, number>,
  solutionTable: Map<number, number>,
  collabTable: Map<number, number>
) {
  console.log(`
// ===============================================
// 子スコアから親スコアを計算する関数
// ===============================================

type DetailScores = {
  // 問題把握の詳細スコア（各1-4の整数）
  problemUnderstanding: number;
  problemEssence: number;
  problemMaintenanceBiz: number;
  problemMaintenanceHr: number;
  problemReformBiz: number;
  problemReformHr: number;

  // 対策立案の詳細スコア（各1-4の整数）
  solutionCoverage: number;
  solutionPlanning: number;
  solutionMaintenanceBiz: number;
  solutionMaintenanceHr: number;
  solutionReformBiz: number;
  solutionReformHr: number;

  // 連携の詳細スコア（各1-4の整数）
  collabSupervisor: number;
  collabExternal: number;
  collabMember: number;
};

type MainScores = {
  problem: number;       // 問題把握 (1.5-5.0, 0.5刻み)
  solution: number;      // 対策立案 (1.5-5.0, 0.5刻み)
  role: number;          // 役割理解 (1.0-5.0, 0.1刻み)
  leadership: number;    // 主導 (1.5-4.0, 0.5刻み)
  collaboration: number; // 連携 (1.5-4.0, 0.5刻み)
  development: number;   // 育成 (1.5-4.0, 0.5刻み)
};

// ルックアップテーブル
const PROBLEM_LOOKUP: Record<number, number> = {
${Array.from(problemTable.entries()).sort((a, b) => a[0] - b[0]).map(([sum, parent]) => `  ${sum}: ${parent}`).join(',\n')}
};

const SOLUTION_LOOKUP: Record<number, number> = {
${Array.from(solutionTable.entries()).sort((a, b) => a[0] - b[0]).map(([sum, parent]) => `  ${sum}: ${parent}`).join(',\n')}
};

const COLLAB_LOOKUP: Record<number, number> = {
${Array.from(collabTable.entries()).sort((a, b) => a[0] - b[0]).map(([sum, parent]) => `  ${sum}: ${parent}`).join(',\n')}
};

/**
 * 詳細スコアから主要スコアを計算
 */
export function calculateMainScores(details: DetailScores): MainScores {
  // 1. 問題把握を計算
  const problemSum =
    details.problemUnderstanding +
    details.problemEssence +
    details.problemMaintenanceBiz +
    details.problemMaintenanceHr +
    details.problemReformBiz +
    details.problemReformHr;

  const problem = PROBLEM_LOOKUP[problemSum] ?? fallbackCalculation(problemSum, 6, 5);

  // 2. 対策立案を計算
  const solutionSum =
    details.solutionCoverage +
    details.solutionPlanning +
    details.solutionMaintenanceBiz +
    details.solutionMaintenanceHr +
    details.solutionReformBiz +
    details.solutionReformHr;

  const solution = SOLUTION_LOOKUP[solutionSum] ?? fallbackCalculation(solutionSum, 6, 5);

  // 3. 連携を計算
  const collabSum =
    details.collabSupervisor +
    details.collabExternal +
    details.collabMember;

  const collaboration = COLLAB_LOOKUP[collabSum] ?? fallbackCalculation(collabSum, 3, 4);

  // 4. 主導を計算（対策立案とほぼ同じ）
  const leadership = Math.min(4, Math.max(1.5, solution));

  // 5. 育成を計算（対策立案の維持管理・人 + 0.5）
  const developmentRaw = details.solutionMaintenanceHr + 0.5;
  const development = Math.min(4, Math.max(1.5, Math.round(developmentRaw / 0.5) * 0.5));

  // 6. 役割理解を計算（連携と主導の平均）
  const roleRaw = (collaboration + leadership) / 2;
  const role = Math.round(roleRaw * 10) / 10;

  return {
    problem,
    solution,
    role,
    leadership,
    collaboration,
    development
  };
}

/**
 * ルックアップテーブルにない場合のフォールバック計算
 */
function fallbackCalculation(sum: number, numChildren: number, maxParent: number): number {
  const avg = sum / numChildren;
  const scaled = (avg / 4) * maxParent;
  return Math.round(scaled / 0.5) * 0.5;
}

// ===============================================
// 使用例
// ===============================================
/*
const details: DetailScores = {
  problemUnderstanding: 3,
  problemEssence: 2,
  problemMaintenanceBiz: 2,
  problemMaintenanceHr: 2,
  problemReformBiz: 2,
  problemReformHr: 1,

  solutionCoverage: 3,
  solutionPlanning: 2,
  solutionMaintenanceBiz: 2,
  solutionMaintenanceHr: 2,
  solutionReformBiz: 2,
  solutionReformHr: 1,

  collabSupervisor: 2,
  collabExternal: 2,
  collabMember: 2
};

const mainScores = calculateMainScores(details);
console.log(mainScores);
// 出力例:
// {
//   problem: 2.5,
//   solution: 2.5,
//   role: 2.5,
//   leadership: 2.5,
//   collaboration: 2.5,
//   development: 2.5
// }
*/
`);
}

generateLookupTable().catch(console.error);
