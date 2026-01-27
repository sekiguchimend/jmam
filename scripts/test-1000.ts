// 1000件で一致率を検証
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test1000() {
  // 1000件取得
  const { data, error, count } = await supabase
    .from('responses')
    .select('*', { count: 'exact' })
    .not('score_problem', 'is', null)
    .limit(1000);

  if (error || !data) {
    console.error('Error:', error);
    return;
  }

  console.log('=== 1000件でのテスト ===\n');
  console.log(`取得データ数: ${data.length}`);
  console.log(`総データ数: ${count}\n`);

  // 問題把握
  const childFields = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  const problemValid = data.filter(d =>
    d.score_problem != null &&
    childFields.every(f => d[f] != null)
  );

  console.log(`問題把握 有効データ: ${problemValid.length}件`);

  // 全パターンのルックアップテーブル作成
  const problemPatterns = new Map<string, Map<number, number>>();
  for (const d of problemValid) {
    const key = childFields.map(f => d[f]).join(',');
    if (!problemPatterns.has(key)) {
      problemPatterns.set(key, new Map());
    }
    const dist = problemPatterns.get(key)!;
    dist.set(d.score_problem, (dist.get(d.score_problem) || 0) + 1);
  }

  // 最頻値でルックアップ
  const problemLookup = new Map<string, number>();
  let problemMaxMatch = 0;
  let problemConflict = 0;

  for (const [key, dist] of problemPatterns.entries()) {
    let maxCount = 0;
    let mode = 0;
    let total = 0;
    for (const [parent, count] of dist.entries()) {
      total += count;
      if (count > maxCount) {
        maxCount = count;
        mode = parent;
      }
    }
    problemLookup.set(key, mode);
    problemMaxMatch += maxCount;
    problemConflict += (total - maxCount);
  }

  console.log(`  パターン数: ${problemLookup.size}`);
  console.log(`  ルックアップ最大一致率: ${(problemMaxMatch / problemValid.length * 100).toFixed(1)}%`);
  console.log(`  矛盾データ: ${problemConflict}件`);

  // 計算式での一致率
  let problemFormulaMatch = 0;
  for (const d of problemValid) {
    const sum = childFields.reduce((acc, f) => acc + d[f], 0);
    const raw = (sum / 6 / 4) * 5;
    let predicted;
    if (d.detail_problem_understanding >= 3 && d.detail_problem_essence < d.detail_problem_understanding) {
      predicted = Math.floor(raw / 0.5) * 0.5;
    } else {
      predicted = Math.round(raw / 0.5) * 0.5;
    }
    if (Math.abs(predicted - d.score_problem) < 0.01) problemFormulaMatch++;
  }
  console.log(`  計算式一致率: ${(problemFormulaMatch / problemValid.length * 100).toFixed(1)}%`);

  // 対策立案
  const solFields = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];

  const solutionValid = data.filter(d =>
    d.score_solution != null &&
    solFields.every(f => d[f] != null)
  );

  console.log(`\n対策立案 有効データ: ${solutionValid.length}件`);

  const solutionPatterns = new Map<string, Map<number, number>>();
  for (const d of solutionValid) {
    const key = solFields.map(f => d[f]).join(',');
    if (!solutionPatterns.has(key)) {
      solutionPatterns.set(key, new Map());
    }
    const dist = solutionPatterns.get(key)!;
    dist.set(d.score_solution, (dist.get(d.score_solution) || 0) + 1);
  }

  const solutionLookup = new Map<string, number>();
  let solutionMaxMatch = 0;
  let solutionConflict = 0;

  for (const [key, dist] of solutionPatterns.entries()) {
    let maxCount = 0;
    let mode = 0;
    let total = 0;
    for (const [parent, count] of dist.entries()) {
      total += count;
      if (count > maxCount) {
        maxCount = count;
        mode = parent;
      }
    }
    solutionLookup.set(key, mode);
    solutionMaxMatch += maxCount;
    solutionConflict += (total - maxCount);
  }

  console.log(`  パターン数: ${solutionLookup.size}`);
  console.log(`  ルックアップ最大一致率: ${(solutionMaxMatch / solutionValid.length * 100).toFixed(1)}%`);
  console.log(`  矛盾データ: ${solutionConflict}件`);

  // 計算式での一致率
  let solutionFormulaMatch = 0;
  for (const d of solutionValid) {
    const sum = solFields.reduce((acc, f) => acc + d[f], 0);
    const raw = (sum / 6 / 4) * 5;
    let predicted;
    if (d.detail_solution_coverage >= 3 && d.detail_solution_planning <= 2) {
      predicted = Math.floor(raw / 0.5) * 0.5;
    } else {
      predicted = Math.round(raw / 0.5) * 0.5;
    }
    if (Math.abs(predicted - d.score_solution) < 0.01) solutionFormulaMatch++;
  }
  console.log(`  計算式一致率: ${(solutionFormulaMatch / solutionValid.length * 100).toFixed(1)}%`);

  // 連携
  const collabFields = ['detail_collab_supervisor', 'detail_collab_external', 'detail_collab_member'];

  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    collabFields.every(f => d[f] != null)
  );

  console.log(`\n連携 有効データ: ${collabValid.length}件`);

  const collabPatterns = new Map<string, Map<number, number>>();
  for (const d of collabValid) {
    const key = collabFields.map(f => d[f]).join(',');
    if (!collabPatterns.has(key)) {
      collabPatterns.set(key, new Map());
    }
    const dist = collabPatterns.get(key)!;
    dist.set(d.score_collaboration, (dist.get(d.score_collaboration) || 0) + 1);
  }

  const collabLookup = new Map<string, number>();
  let collabMaxMatch = 0;
  let collabConflict = 0;

  for (const [key, dist] of collabPatterns.entries()) {
    let maxCount = 0;
    let mode = 0;
    let total = 0;
    for (const [parent, count] of dist.entries()) {
      total += count;
      if (count > maxCount) {
        maxCount = count;
        mode = parent;
      }
    }
    collabLookup.set(key, mode);
    collabMaxMatch += maxCount;
    collabConflict += (total - maxCount);
  }

  console.log(`  パターン数: ${collabLookup.size}`);
  console.log(`  ルックアップ最大一致率: ${(collabMaxMatch / collabValid.length * 100).toFixed(1)}%`);
  console.log(`  矛盾データ: ${collabConflict}件`);

  // 計算式での一致率
  let collabFormulaMatch = 0;
  for (const d of collabValid) {
    const sum = d.detail_collab_supervisor + d.detail_collab_external + d.detail_collab_member;
    const predicted = Math.round((sum / 2 - 0.5) * 2) / 2;
    const clamped = Math.max(1, Math.min(4, predicted));
    if (Math.abs(clamped - d.score_collaboration) < 0.01) collabFormulaMatch++;
  }
  console.log(`  計算式一致率: ${(collabFormulaMatch / collabValid.length * 100).toFixed(1)}%`);

  // まとめ
  console.log('\n' + '='.repeat(50));
  console.log('【まとめ】');
  console.log('='.repeat(50));
  console.log(`
| スコア     | データ数 | パターン | ルックアップ | 計算式  | 矛盾 |
|------------|----------|----------|--------------|---------|------|
| 問題把握   | ${problemValid.length.toString().padStart(4)}件  | ${problemLookup.size.toString().padStart(4)}種類 | ${(problemMaxMatch / problemValid.length * 100).toFixed(1)}%       | ${(problemFormulaMatch / problemValid.length * 100).toFixed(1)}%  | ${problemConflict}件 |
| 対策立案   | ${solutionValid.length.toString().padStart(4)}件  | ${solutionLookup.size.toString().padStart(4)}種類 | ${(solutionMaxMatch / solutionValid.length * 100).toFixed(1)}%       | ${(solutionFormulaMatch / solutionValid.length * 100).toFixed(1)}%  | ${solutionConflict}件 |
| 連携       | ${collabValid.length.toString().padStart(4)}件  | ${collabLookup.size.toString().padStart(4)}種類 | ${(collabMaxMatch / collabValid.length * 100).toFixed(1)}%       | ${(collabFormulaMatch / collabValid.length * 100).toFixed(1)}%  | ${collabConflict}件 |
`);
}

test1000().catch(console.error);
