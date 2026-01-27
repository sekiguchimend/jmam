// 子スコア → 親スコア の計算ロジックを特定するスクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function analyze() {
  console.log('=== 子スコア → 親スコア 計算ロジック分析 ===\n');

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
  // 1. 問題把握の親子関係を厳密に分析
  // =============================================
  console.log('='.repeat(70));
  console.log('【1. 問題把握 (score_problem) の親子関係】');
  console.log('='.repeat(70));

  const problemChildren = [
    'detail_problem_understanding',  // 状況理解
    'detail_problem_essence',        // 本質把握
    'detail_problem_maintenance_biz', // 維持管理・業務
    'detail_problem_maintenance_hr',  // 維持管理・人
    'detail_problem_reform_biz',     // 改革・業務
    'detail_problem_reform_hr'       // 改革・人
  ];

  analyzeParentChild(data, 'score_problem', problemChildren, 5, 0.5);

  // =============================================
  // 2. 対策立案の親子関係を厳密に分析
  // =============================================
  console.log('\n' + '='.repeat(70));
  console.log('【2. 対策立案 (score_solution) の親子関係】');
  console.log('='.repeat(70));

  const solutionChildren = [
    'detail_solution_coverage',      // 網羅性
    'detail_solution_planning',      // 計画性
    'detail_solution_maintenance_biz', // 維持管理・業務
    'detail_solution_maintenance_hr',  // 維持管理・人
    'detail_solution_reform_biz',    // 改革・業務
    'detail_solution_reform_hr'      // 改革・人
  ];

  analyzeParentChild(data, 'score_solution', solutionChildren, 5, 0.5);

  // =============================================
  // 3. 連携の親子関係を厳密に分析
  // =============================================
  console.log('\n' + '='.repeat(70));
  console.log('【3. 連携 (score_collaboration) の親子関係】');
  console.log('='.repeat(70));

  const collabChildren = [
    'detail_collab_supervisor',  // 上司
    'detail_collab_external',    // 職場外
    'detail_collab_member'       // メンバー
  ];

  analyzeParentChild(data, 'score_collaboration', collabChildren, 4, 0.5);

  // =============================================
  // 4. 役割理解・主導・育成の親子関係を探る
  // =============================================
  console.log('\n' + '='.repeat(70));
  console.log('【4. 役割理解・主導・育成 の計算元を探る】');
  console.log('='.repeat(70));

  analyzeIndependentScores(data);
}

function analyzeParentChild(
  data: any[],
  parentField: string,
  childFields: string[],
  parentMax: number,
  parentStep: number
) {
  // 有効データのみ
  const valid = data.filter(d =>
    d[parentField] != null &&
    childFields.every(cf => d[cf] != null)
  );

  console.log(`\n有効データ数: ${valid.length}`);

  // 子スコアの合計ごとにグループ化
  const bySum = new Map<number, { parent: number; children: number[]; count: number }[]>();

  for (const d of valid) {
    const children = childFields.map(cf => d[cf] as number);
    const sum = children.reduce((a, b) => a + b, 0);
    const parent = d[parentField] as number;

    if (!bySum.has(sum)) {
      bySum.set(sum, []);
    }
    bySum.get(sum)!.push({ parent, children, count: 1 });
  }

  // 合計値ごとの親スコア分布を表示
  console.log('\n【子スコア合計 → 親スコア の対応表】');
  console.log(`${'合計'.padStart(4)} | ${'親スコア分布'.padEnd(50)} | 最頻値 | 推定式結果`);
  console.log('-'.repeat(80));

  const sumToParent: Map<number, number> = new Map();
  const sortedSums = Array.from(bySum.keys()).sort((a, b) => a - b);

  for (const sum of sortedSums) {
    const items = bySum.get(sum)!;

    // 親スコアの分布を集計
    const parentDist = new Map<number, number>();
    for (const item of items) {
      parentDist.set(item.parent, (parentDist.get(item.parent) || 0) + 1);
    }

    // 最頻値を取得
    let modeParent = 0;
    let maxCount = 0;
    for (const [p, c] of parentDist.entries()) {
      if (c > maxCount) {
        maxCount = c;
        modeParent = p;
      }
    }
    sumToParent.set(sum, modeParent);

    // 分布を文字列化
    const distStr = Array.from(parentDist.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([p, c]) => `${p}(${c})`)
      .join(', ');

    // 推定式での計算結果
    const avg = sum / childFields.length;
    const scaled = (avg / 4) * parentMax;
    const rounded = Math.round(scaled / parentStep) * parentStep;

    console.log(`${sum.toString().padStart(4)} | ${distStr.padEnd(50)} | ${modeParent.toFixed(1).padStart(5)} | ${rounded.toFixed(1)}`);
  }

  // 計算式の検証
  console.log('\n【計算式の検証】');

  // 式1: 単純平均をスケール変換して丸め
  let match1 = 0;
  for (const d of valid) {
    const children = childFields.map(cf => d[cf] as number);
    const sum = children.reduce((a, b) => a + b, 0);
    const avg = sum / childFields.length;
    const scaled = (avg / 4) * parentMax;
    const predicted = Math.round(scaled / parentStep) * parentStep;
    if (Math.abs(predicted - d[parentField]) < 0.01) match1++;
  }
  console.log(`式1: round((合計/${childFields.length}/4)*${parentMax}, ${parentStep}刻み)`);
  console.log(`   一致率: ${(match1 / valid.length * 100).toFixed(1)}% (${match1}/${valid.length})`);

  // 式2: 合計を直接スケール変換
  let match2 = 0;
  const maxSum = childFields.length * 4;
  for (const d of valid) {
    const children = childFields.map(cf => d[cf] as number);
    const sum = children.reduce((a, b) => a + b, 0);
    const scaled = (sum / maxSum) * parentMax;
    const predicted = Math.round(scaled / parentStep) * parentStep;
    if (Math.abs(predicted - d[parentField]) < 0.01) match2++;
  }
  console.log(`式2: round((合計/${maxSum})*${parentMax}, ${parentStep}刻み)`);
  console.log(`   一致率: ${(match2 / valid.length * 100).toFixed(1)}% (${match2}/${valid.length})`);

  // 式3: 切り上げ
  let match3 = 0;
  for (const d of valid) {
    const children = childFields.map(cf => d[cf] as number);
    const sum = children.reduce((a, b) => a + b, 0);
    const avg = sum / childFields.length;
    const scaled = (avg / 4) * parentMax;
    const predicted = Math.ceil(scaled / parentStep) * parentStep;
    if (Math.abs(predicted - d[parentField]) < 0.01) match3++;
  }
  console.log(`式3: ceil((合計/${childFields.length}/4)*${parentMax}, ${parentStep}刻み)`);
  console.log(`   一致率: ${(match3 / valid.length * 100).toFixed(1)}% (${match3}/${valid.length})`);

  // 式4: 切り捨て
  let match4 = 0;
  for (const d of valid) {
    const children = childFields.map(cf => d[cf] as number);
    const sum = children.reduce((a, b) => a + b, 0);
    const avg = sum / childFields.length;
    const scaled = (avg / 4) * parentMax;
    const predicted = Math.floor(scaled / parentStep) * parentStep;
    if (Math.abs(predicted - d[parentField]) < 0.01) match4++;
  }
  console.log(`式4: floor((合計/${childFields.length}/4)*${parentMax}, ${parentStep}刻み)`);
  console.log(`   一致率: ${(match4 / valid.length * 100).toFixed(1)}% (${match4}/${valid.length})`);

  // 不一致のパターンを分析
  console.log('\n【不一致パターンの分析】');
  const mismatches: { sum: number; actual: number; predicted: number; diff: number; children: number[] }[] = [];

  for (const d of valid) {
    const children = childFields.map(cf => d[cf] as number);
    const sum = children.reduce((a, b) => a + b, 0);
    const avg = sum / childFields.length;
    const scaled = (avg / 4) * parentMax;
    const predicted = Math.round(scaled / parentStep) * parentStep;
    const actual = d[parentField];

    if (Math.abs(predicted - actual) >= 0.01) {
      mismatches.push({
        sum,
        actual,
        predicted,
        diff: actual - predicted,
        children
      });
    }
  }

  console.log(`不一致件数: ${mismatches.length}/${valid.length}`);

  // 不一致のパターンを集計
  const diffPattern = new Map<string, number>();
  for (const m of mismatches) {
    const key = `sum=${m.sum}, predicted=${m.predicted}, actual=${m.actual}, diff=${m.diff.toFixed(1)}`;
    diffPattern.set(key, (diffPattern.get(key) || 0) + 1);
  }

  console.log('\n上位の不一致パターン:');
  const sortedPatterns = Array.from(diffPattern.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  for (const [pattern, count] of sortedPatterns) {
    console.log(`  ${pattern}: ${count}件`);
  }

  // 子スコアの個別パターンを分析
  console.log('\n【子スコア個別の影響分析】');
  for (let i = 0; i < childFields.length; i++) {
    const fieldName = childFields[i].replace('detail_', '').replace('problem_', '').replace('solution_', '').replace('collab_', '');

    // この子スコアの値ごとの親スコア平均
    const byChild = new Map<number, number[]>();
    for (const d of valid) {
      const childVal = d[childFields[i]];
      if (!byChild.has(childVal)) {
        byChild.set(childVal, []);
      }
      byChild.get(childVal)!.push(d[parentField]);
    }

    const avgByChild = Array.from(byChild.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([child, parents]) => {
        const avg = parents.reduce((a, b) => a + b, 0) / parents.length;
        return `${child}→${avg.toFixed(2)}`;
      })
      .join(', ');

    console.log(`  ${fieldName}: ${avgByChild}`);
  }
}

function analyzeIndependentScores(data: any[]) {
  // 役割理解、主導、育成の計算元を探る

  console.log('\n【役割理解 (score_role) の計算元探索】');

  const roleValid = data.filter(d =>
    d.score_role != null &&
    d.score_problem != null &&
    d.score_solution != null
  );

  // 問題把握と対策立案の組み合わせで役割理解を予測できるか
  const byProblemSolution = new Map<string, number[]>();
  for (const d of roleValid) {
    const key = `${d.score_problem}-${d.score_solution}`;
    if (!byProblemSolution.has(key)) {
      byProblemSolution.set(key, []);
    }
    byProblemSolution.get(key)!.push(d.score_role);
  }

  console.log('\nproblem-solution組み合わせごとの役割理解:');
  const sortedKeys = Array.from(byProblemSolution.keys()).sort();
  for (const key of sortedKeys.slice(0, 20)) {
    const roles = byProblemSolution.get(key)!;
    const avg = roles.reduce((a, b) => a + b, 0) / roles.length;
    const min = Math.min(...roles);
    const max = Math.max(...roles);
    console.log(`  ${key}: avg=${avg.toFixed(2)}, range=[${min}, ${max}], n=${roles.length}`);
  }

  // 式を試す
  console.log('\n役割理解の計算式検証:');

  // 式1: (problem + solution) / 2
  let match1 = 0;
  for (const d of roleValid) {
    const predicted = (d.score_problem + d.score_solution) / 2;
    const rounded = Math.round(predicted * 10) / 10;  // 0.1刻み
    if (Math.abs(rounded - d.score_role) < 0.05) match1++;
  }
  console.log(`  式1 (problem + solution) / 2: 一致率 ${(match1 / roleValid.length * 100).toFixed(1)}%`);

  // 式2: problem * 0.4 + solution * 0.6
  let match2 = 0;
  for (const d of roleValid) {
    const predicted = d.score_problem * 0.4 + d.score_solution * 0.6;
    const rounded = Math.round(predicted * 10) / 10;
    if (Math.abs(rounded - d.score_role) < 0.05) match2++;
  }
  console.log(`  式2 problem*0.4 + solution*0.6: 一致率 ${(match2 / roleValid.length * 100).toFixed(1)}%`);

  // 主導と育成も同様に分析
  console.log('\n【主導 (score_leadership) の計算元探索】');

  const leaderValid = data.filter(d =>
    d.score_leadership != null &&
    d.score_problem != null &&
    d.score_solution != null &&
    d.score_role != null
  );

  // 詳細スコアとの関係
  const solutionDetails = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];

  const leaderWithDetails = leaderValid.filter(d =>
    solutionDetails.every(sd => d[sd] != null)
  );

  if (leaderWithDetails.length > 0) {
    console.log(`\n対策立案の詳細スコアから主導を予測:`);

    // 計画性との関係
    let matchPlanning = 0;
    for (const d of leaderWithDetails) {
      const planning = d.detail_solution_planning;
      const predicted = Math.round(planning / 0.5) * 0.5;
      if (Math.abs(predicted - d.score_leadership) < 0.01) matchPlanning++;
    }
    console.log(`  計画性から予測: 一致率 ${(matchPlanning / leaderWithDetails.length * 100).toFixed(1)}%`);

    // 網羅性＋計画性
    let matchCovPlan = 0;
    for (const d of leaderWithDetails) {
      const avg = (d.detail_solution_coverage + d.detail_solution_planning) / 2;
      const predicted = Math.round(avg / 0.5) * 0.5;
      if (Math.abs(predicted - d.score_leadership) < 0.01) matchCovPlan++;
    }
    console.log(`  (網羅性+計画性)/2から予測: 一致率 ${(matchCovPlan / leaderWithDetails.length * 100).toFixed(1)}%`);
  }

  console.log('\n【育成 (score_development) の計算元探索】');

  const devValid = data.filter(d =>
    d.score_development != null &&
    d.score_problem != null &&
    d.score_solution != null
  );

  // 維持管理・人との関係
  const devWithDetails = devValid.filter(d =>
    d.detail_solution_maintenance_hr != null &&
    d.detail_problem_maintenance_hr != null
  );

  if (devWithDetails.length > 0) {
    console.log(`\n維持管理・人（HR系）から育成を予測:`);

    let matchHr = 0;
    for (const d of devWithDetails) {
      const hrAvg = (d.detail_problem_maintenance_hr + d.detail_solution_maintenance_hr) / 2;
      const predicted = Math.round(hrAvg / 0.5) * 0.5;
      if (Math.abs(predicted - d.score_development) < 0.01) matchHr++;
    }
    console.log(`  HR平均から予測: 一致率 ${(matchHr / devWithDetails.length * 100).toFixed(1)}%`);
  }

  // 全詳細スコアとの相関を計算
  console.log('\n【全詳細スコアとの相関】');
  const allDetails = [
    'detail_problem_understanding', 'detail_problem_essence',
    'detail_problem_maintenance_biz', 'detail_problem_maintenance_hr',
    'detail_problem_reform_biz', 'detail_problem_reform_hr',
    'detail_solution_coverage', 'detail_solution_planning',
    'detail_solution_maintenance_biz', 'detail_solution_maintenance_hr',
    'detail_solution_reform_biz', 'detail_solution_reform_hr',
    'detail_collab_supervisor', 'detail_collab_external', 'detail_collab_member'
  ];

  for (const target of ['score_role', 'score_leadership', 'score_development']) {
    console.log(`\n${target}との相関:`);
    const targetValid = data.filter(d => d[target] != null);

    for (const detail of allDetails) {
      const validBoth = targetValid.filter(d => d[detail] != null);
      if (validBoth.length < 50) continue;

      const corr = calculateCorrelation(
        validBoth.map(d => d[target]),
        validBoth.map(d => d[detail])
      );
      if (Math.abs(corr) > 0.3) {
        const shortName = detail.replace('detail_', '').replace('problem_', 'p_').replace('solution_', 's_').replace('collab_', 'c_');
        console.log(`  ${shortName}: ${corr.toFixed(3)}`);
      }
    }
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let num = 0, denomX = 0, denomY = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    num += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denom = Math.sqrt(denomX * denomY);
  return denom === 0 ? 0 : num / denom;
}

analyze().catch(console.error);
