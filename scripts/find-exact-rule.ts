// 100%に近い計算式を見つける
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findExactRule() {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) {
    console.error('Error:', error);
    return;
  }

  console.log('=== 連携の詳細分析 ===\n');

  // 連携を詳細に分析
  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    d.detail_collab_supervisor != null &&
    d.detail_collab_external != null &&
    d.detail_collab_member != null
  );

  console.log(`データ数: ${collabValid.length}\n`);

  // 全パターンを表示
  const patterns = new Map<string, { actual: number; count: number }>();

  for (const d of collabValid) {
    const sup = d.detail_collab_supervisor;
    const ext = d.detail_collab_external;
    const mem = d.detail_collab_member;
    const actual = d.score_collaboration;

    const key = `[${sup},${ext},${mem}]`;

    if (!patterns.has(key)) {
      patterns.set(key, { actual, count: 1 });
    } else {
      const existing = patterns.get(key)!;
      if (existing.actual !== actual) {
        // 同じ子スコアで異なる親スコアがある
        console.log(`不整合: ${key} → ${existing.actual} と ${actual} の両方がある`);
      }
      existing.count++;
    }
  }

  console.log('\n=== 連携: 全パターン ===');
  console.log('[上司,職場外,メンバー] → 親スコア (件数)');
  console.log('');

  const sortedPatterns = Array.from(patterns.entries())
    .sort((a, b) => {
      const [sup1, ext1, mem1] = a[0].slice(1, -1).split(',').map(Number);
      const [sup2, ext2, mem2] = b[0].slice(1, -1).split(',').map(Number);
      return (sup1 * 100 + ext1 * 10 + mem1) - (sup2 * 100 + ext2 * 10 + mem2);
    });

  for (const [key, val] of sortedPatterns) {
    const [sup, ext, mem] = key.slice(1, -1).split(',').map(Number);
    const sum = sup + ext + mem;
    const formula1 = sum / 2 - 0.5;
    const match1 = Math.abs(formula1 - val.actual) < 0.01 ? '✓' : '✗';

    console.log(`${key} 合計${sum} → ${val.actual} (${val.count}件) | 式1=${formula1.toFixed(1)} ${match1}`);
  }

  // 不一致を分析
  console.log('\n=== 不一致パターンの分析 ===');

  let mismatchCount = 0;
  for (const [key, val] of sortedPatterns) {
    const [sup, ext, mem] = key.slice(1, -1).split(',').map(Number);
    const sum = sup + ext + mem;
    const formula1 = sum / 2 - 0.5;

    if (Math.abs(formula1 - val.actual) >= 0.01) {
      mismatchCount += val.count;
      const diff = val.actual - formula1;
      console.log(`${key} → 実際=${val.actual}, 式=${formula1.toFixed(1)}, 差=${diff.toFixed(1)} (${val.count}件)`);
    }
  }

  console.log(`\n不一致合計: ${mismatchCount}/${collabValid.length}件`);

  // 問題把握も同様に
  console.log('\n\n=== 問題把握の詳細分析 ===\n');

  const problemValid = data.filter(d =>
    d.score_problem != null &&
    d.detail_problem_understanding != null &&
    d.detail_problem_essence != null &&
    d.detail_problem_maintenance_biz != null &&
    d.detail_problem_maintenance_hr != null &&
    d.detail_problem_reform_biz != null &&
    d.detail_problem_reform_hr != null
  );

  console.log(`データ数: ${problemValid.length}\n`);

  // 合計ごとの親スコア分布を詳細に
  const bySum = new Map<number, Map<number, number>>();

  for (const d of problemValid) {
    const sum = d.detail_problem_understanding +
      d.detail_problem_essence +
      d.detail_problem_maintenance_biz +
      d.detail_problem_maintenance_hr +
      d.detail_problem_reform_biz +
      d.detail_problem_reform_hr;
    const parent = d.score_problem;

    if (!bySum.has(sum)) {
      bySum.set(sum, new Map());
    }
    bySum.get(sum)!.set(parent, (bySum.get(sum)!.get(parent) || 0) + 1);
  }

  console.log('合計 → 親スコア分布');
  const sortedSums = Array.from(bySum.keys()).sort((a, b) => a - b);

  for (const sum of sortedSums) {
    const dist = bySum.get(sum)!;
    const distStr = Array.from(dist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([p, c]) => `${p}(${c})`)
      .join(', ');

    const total = Array.from(dist.values()).reduce((a, b) => a + b, 0);
    const formula = Math.round((sum / 6) * 1.25 * 2) / 2;

    console.log(`合計${sum.toString().padStart(2)}: ${distStr.padEnd(30)} | 式=${formula.toFixed(1)}`);
  }

  // 同じ合計でも親スコアが違う理由を探る
  console.log('\n=== 同じ合計で親スコアが異なるケースの分析 ===');

  for (const sum of [11, 15, 17]) {  // 不一致が多い合計値
    console.log(`\n合計${sum}のケース:`);

    const cases = problemValid.filter(d => {
      const s = d.detail_problem_understanding +
        d.detail_problem_essence +
        d.detail_problem_maintenance_biz +
        d.detail_problem_maintenance_hr +
        d.detail_problem_reform_biz +
        d.detail_problem_reform_hr;
      return s === sum;
    });

    // 親スコアごとにグループ化
    const byParent = new Map<number, any[]>();
    for (const c of cases) {
      const p = c.score_problem;
      if (!byParent.has(p)) byParent.set(p, []);
      byParent.get(p)!.push(c);
    }

    for (const [parent, items] of Array.from(byParent.entries()).sort((a, b) => a[0] - b[0])) {
      console.log(`  親=${parent}: ${items.length}件`);

      // 子スコアのパターンを集計
      const childPatterns = new Map<string, number>();
      for (const item of items) {
        const pattern = `[${item.detail_problem_understanding},${item.detail_problem_essence},${item.detail_problem_maintenance_biz},${item.detail_problem_maintenance_hr},${item.detail_problem_reform_biz},${item.detail_problem_reform_hr}]`;
        childPatterns.set(pattern, (childPatterns.get(pattern) || 0) + 1);
      }

      // 上位3パターンを表示
      const sortedChildPatterns = Array.from(childPatterns.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3);

      for (const [pattern, count] of sortedChildPatterns) {
        console.log(`    ${pattern}: ${count}件`);
      }
    }
  }
}

findExactRule().catch(console.error);
