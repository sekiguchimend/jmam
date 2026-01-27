// 正確な計算式を特定するスクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function findExactFormula() {
  console.log('=== 正確な計算式の特定 ===\n');

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
  // 1. 問題把握の正確な計算式を探す
  // =============================================
  console.log('='.repeat(70));
  console.log('【1. 問題把握 (score_problem) の計算式特定】');
  console.log('='.repeat(70));

  const problemChildren = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  findBestFormula(data, 'score_problem', problemChildren, 5, 0.5);

  // =============================================
  // 2. 対策立案の正確な計算式を探す
  // =============================================
  console.log('\n' + '='.repeat(70));
  console.log('【2. 対策立案 (score_solution) の計算式特定】');
  console.log('='.repeat(70));

  const solutionChildren = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];

  findBestFormula(data, 'score_solution', solutionChildren, 5, 0.5);

  // =============================================
  // 3. 連携の正確な計算式を探す
  // =============================================
  console.log('\n' + '='.repeat(70));
  console.log('【3. 連携 (score_collaboration) の計算式特定】');
  console.log('='.repeat(70));

  const collabChildren = [
    'detail_collab_supervisor',
    'detail_collab_external',
    'detail_collab_member'
  ];

  findBestFormula(data, 'score_collaboration', collabChildren, 4, 0.5);

  // =============================================
  // 4. 役割理解・主導・育成の計算式を探す
  // =============================================
  console.log('\n' + '='.repeat(70));
  console.log('【4. 役割理解 (score_role) の計算式特定】');
  console.log('='.repeat(70));

  findRoleFormula(data);

  console.log('\n' + '='.repeat(70));
  console.log('【5. 主導 (score_leadership) の計算式特定】');
  console.log('='.repeat(70));

  findLeadershipFormula(data);

  console.log('\n' + '='.repeat(70));
  console.log('【6. 育成 (score_development) の計算式特定】');
  console.log('='.repeat(70));

  findDevelopmentFormula(data);
}

function findBestFormula(
  data: any[],
  parentField: string,
  childFields: string[],
  parentMax: number,
  parentStep: number
) {
  const valid = data.filter(d =>
    d[parentField] != null &&
    childFields.every(cf => d[cf] != null)
  );

  console.log(`\n有効データ数: ${valid.length}`);

  // 様々な計算式を試す
  const formulas: { name: string; calc: (d: any) => number; matchRate?: number }[] = [];

  // 基本計算式
  formulas.push({
    name: '平均 × (親max/4) [四捨五入]',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      const avg = sum / childFields.length;
      const scaled = (avg / 4) * parentMax;
      return Math.round(scaled / parentStep) * parentStep;
    }
  });

  formulas.push({
    name: '平均 × (親max/4) [切り捨て]',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      const avg = sum / childFields.length;
      const scaled = (avg / 4) * parentMax;
      return Math.floor(scaled / parentStep) * parentStep;
    }
  });

  formulas.push({
    name: '平均 × (親max/4) [切り上げ]',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      const avg = sum / childFields.length;
      const scaled = (avg / 4) * parentMax;
      return Math.ceil(scaled / parentStep) * parentStep;
    }
  });

  // 合計ベースのスケーリング
  formulas.push({
    name: '(合計/最大合計) × 親max [四捨五入]',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      const maxSum = childFields.length * 4;
      const scaled = (sum / maxSum) * parentMax;
      return Math.round(scaled / parentStep) * parentStep;
    }
  });

  // オフセット付き
  for (const offset of [-0.5, -0.25, 0.25, 0.5]) {
    formulas.push({
      name: `平均 × (親max/4) + ${offset} [四捨五入]`,
      calc: (d) => {
        const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
        const avg = sum / childFields.length;
        const scaled = (avg / 4) * parentMax + offset;
        return Math.round(scaled / parentStep) * parentStep;
      }
    });
  }

  // 最小値1を考慮
  formulas.push({
    name: 'max(1, 平均 × (親max/4)) [四捨五入]',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      const avg = sum / childFields.length;
      const scaled = Math.max(1, (avg / 4) * parentMax);
      return Math.round(scaled / parentStep) * parentStep;
    }
  });

  // 合計から直接マッピング（ルックアップテーブル方式）
  // まず合計→親スコアの最頻値マッピングを作成
  const sumToParentMode = new Map<number, number>();
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

  for (const [sum, dist] of bySum.entries()) {
    let maxCount = 0;
    let mode = 0;
    for (const [parent, count] of dist.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mode = parent;
      }
    }
    sumToParentMode.set(sum, mode);
  }

  formulas.push({
    name: '合計→親スコア ルックアップテーブル（最頻値）',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      return sumToParentMode.get(sum) ?? 0;
    }
  });

  // 異なる丸め方法
  formulas.push({
    name: '合計÷6 を直接親スコアに（四捨五入0.5刻み）',
    calc: (d) => {
      const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
      const direct = sum / childFields.length;
      return Math.round(direct / 0.5) * 0.5;
    }
  });

  // 連携専用：+0.5オフセット
  if (parentField === 'score_collaboration') {
    formulas.push({
      name: '平均 + 0.5 [四捨五入]',
      calc: (d) => {
        const sum = childFields.reduce((acc, cf) => acc + d[cf], 0);
        const avg = sum / childFields.length;
        const scaled = avg + 0.5;
        return Math.round(scaled / parentStep) * parentStep;
      }
    });

    formulas.push({
      name: '(上司×0.4 + 職場外×0.4 + メンバー×0.2) + 0.5',
      calc: (d) => {
        const sup = d.detail_collab_supervisor;
        const ext = d.detail_collab_external;
        const mem = d.detail_collab_member;
        const weighted = sup * 0.4 + ext * 0.4 + mem * 0.2;
        const scaled = weighted + 0.5;
        return Math.round(scaled / 0.5) * 0.5;
      }
    });

    formulas.push({
      name: 'max(上司, 職場外) + 0.5 [四捨五入]',
      calc: (d) => {
        const sup = d.detail_collab_supervisor;
        const ext = d.detail_collab_external;
        const maxVal = Math.max(sup, ext);
        return Math.round((maxVal + 0.5) / 0.5) * 0.5;
      }
    });
  }

  // 各式の一致率を計算
  for (const formula of formulas) {
    let match = 0;
    for (const d of valid) {
      const predicted = formula.calc(d);
      const actual = d[parentField];
      if (Math.abs(predicted - actual) < 0.01) {
        match++;
      }
    }
    formula.matchRate = match / valid.length * 100;
  }

  // ソートして表示
  formulas.sort((a, b) => (b.matchRate || 0) - (a.matchRate || 0));

  console.log('\n計算式の一致率ランキング:');
  for (const formula of formulas.slice(0, 10)) {
    console.log(`  ${formula.matchRate!.toFixed(1)}% : ${formula.name}`);
  }

  // 最良の式で不一致パターンを分析
  const bestFormula = formulas[0];
  console.log(`\n最良式: ${bestFormula.name}`);

  // 不一致の詳細
  const mismatches: { children: number[]; sum: number; predicted: number; actual: number }[] = [];
  for (const d of valid) {
    const predicted = bestFormula.calc(d);
    const actual = d[parentField];
    if (Math.abs(predicted - actual) >= 0.01) {
      const children = childFields.map(cf => d[cf]);
      const sum = children.reduce((a, b) => a + b, 0);
      mismatches.push({ children, sum, predicted, actual });
    }
  }

  console.log(`\n不一致件数: ${mismatches.length}/${valid.length}`);

  if (mismatches.length > 0 && mismatches.length <= 50) {
    console.log('\n不一致の全パターン:');
    const patterns = new Map<string, number>();
    for (const m of mismatches) {
      const key = `[${m.children.join(',')}] sum=${m.sum} → pred=${m.predicted} vs actual=${m.actual}`;
      patterns.set(key, (patterns.get(key) || 0) + 1);
    }

    const sorted = Array.from(patterns.entries()).sort((a, b) => b[1] - a[1]);
    for (const [pattern, count] of sorted.slice(0, 20)) {
      console.log(`  ${count}件: ${pattern}`);
    }
  }
}

function findRoleFormula(data: any[]) {
  const valid = data.filter(d =>
    d.score_role != null &&
    d.score_problem != null &&
    d.score_solution != null &&
    d.score_leadership != null &&
    d.score_collaboration != null
  );

  console.log(`\n有効データ数: ${valid.length}`);

  const formulas: { name: string; calc: (d: any) => number; matchRate?: number }[] = [];

  // 基本式
  formulas.push({
    name: '(problem + solution) / 2 [0.1刻み]',
    calc: (d) => Math.round((d.score_problem + d.score_solution) / 2 * 10) / 10
  });

  formulas.push({
    name: '(problem + solution) / 2 [0.5刻み→0.1刻み補正]',
    calc: (d) => {
      const avg = (d.score_problem + d.score_solution) / 2;
      return Math.round(avg * 10) / 10;
    }
  });

  // 加重平均
  for (const w of [0.3, 0.4, 0.5, 0.6, 0.7]) {
    formulas.push({
      name: `problem×${w} + solution×${(1 - w).toFixed(1)} [0.1刻み]`,
      calc: (d) => Math.round((d.score_problem * w + d.score_solution * (1 - w)) * 10) / 10
    });
  }

  // 連携との関係
  formulas.push({
    name: '(problem + solution + collaboration) / 3 [0.1刻み]',
    calc: (d) => Math.round((d.score_problem + d.score_solution + d.score_collaboration) / 3 * 10) / 10
  });

  // 連携と主導の加重平均
  formulas.push({
    name: '(collaboration + leadership) / 2 [0.1刻み]',
    calc: (d) => Math.round((d.score_collaboration + d.score_leadership) / 2 * 10) / 10
  });

  // 全部の平均
  formulas.push({
    name: '(problem + solution + leadership + collaboration) / 4 [0.1刻み]',
    calc: (d) => Math.round((d.score_problem + d.score_solution + d.score_leadership + d.score_collaboration) / 4 * 10) / 10
  });

  // 各式の一致率を計算
  for (const formula of formulas) {
    let match = 0;
    for (const d of valid) {
      const predicted = formula.calc(d);
      const actual = d.score_role;
      if (Math.abs(predicted - actual) < 0.05) {
        match++;
      }
    }
    formula.matchRate = match / valid.length * 100;
  }

  formulas.sort((a, b) => (b.matchRate || 0) - (a.matchRate || 0));

  console.log('\n計算式の一致率ランキング:');
  for (const formula of formulas.slice(0, 10)) {
    console.log(`  ${formula.matchRate!.toFixed(1)}% : ${formula.name}`);
  }

  // 誤差の分布を確認
  const bestFormula = formulas[0];
  const errors: number[] = [];
  for (const d of valid) {
    const predicted = bestFormula.calc(d);
    const actual = d.score_role;
    errors.push(actual - predicted);
  }

  const avgError = errors.reduce((a, b) => a + b, 0) / errors.length;
  const mae = errors.reduce((a, b) => a + Math.abs(b), 0) / errors.length;

  console.log(`\n最良式の誤差: 平均誤差=${avgError.toFixed(3)}, MAE=${mae.toFixed(3)}`);
}

function findLeadershipFormula(data: any[]) {
  const valid = data.filter(d =>
    d.score_leadership != null &&
    d.score_solution != null &&
    d.detail_solution_coverage != null &&
    d.detail_solution_planning != null
  );

  console.log(`\n有効データ数: ${valid.length}`);

  const formulas: { name: string; calc: (d: any) => number; matchRate?: number }[] = [];

  // 対策立案から
  formulas.push({
    name: 'solution [0.5刻み]',
    calc: (d) => Math.round(d.score_solution / 0.5) * 0.5
  });

  // 網羅性と計画性
  formulas.push({
    name: '(coverage + planning) / 2 [0.5刻み]',
    calc: (d) => Math.round((d.detail_solution_coverage + d.detail_solution_planning) / 2 / 0.5) * 0.5
  });

  formulas.push({
    name: 'planning [0.5刻み]',
    calc: (d) => Math.round(d.detail_solution_planning / 0.5) * 0.5
  });

  // 維持管理系
  formulas.push({
    name: '(maint_biz + maint_hr) / 2 [0.5刻み]',
    calc: (d) => Math.round((d.detail_solution_maintenance_biz + d.detail_solution_maintenance_hr) / 2 / 0.5) * 0.5
  });

  // 全詳細スコアの平均
  formulas.push({
    name: '対策立案詳細6項目平均 [0.5刻み]',
    calc: (d) => {
      const avg = (d.detail_solution_coverage + d.detail_solution_planning +
        d.detail_solution_maintenance_biz + d.detail_solution_maintenance_hr +
        d.detail_solution_reform_biz + d.detail_solution_reform_hr) / 6;
      return Math.round(avg / 0.5) * 0.5;
    }
  });

  // solution ベース
  formulas.push({
    name: 'solution - 0.5 + 1 [0.5刻み]',
    calc: (d) => Math.round((d.score_solution - 0.5 + 1) / 0.5) * 0.5
  });

  // 各式の一致率を計算
  for (const formula of formulas) {
    let match = 0;
    for (const d of valid) {
      const predicted = formula.calc(d);
      const actual = d.score_leadership;
      if (Math.abs(predicted - actual) < 0.01) {
        match++;
      }
    }
    formula.matchRate = match / valid.length * 100;
  }

  formulas.sort((a, b) => (b.matchRate || 0) - (a.matchRate || 0));

  console.log('\n計算式の一致率ランキング:');
  for (const formula of formulas.slice(0, 10)) {
    console.log(`  ${formula.matchRate!.toFixed(1)}% : ${formula.name}`);
  }
}

function findDevelopmentFormula(data: any[]) {
  const valid = data.filter(d =>
    d.score_development != null &&
    d.detail_solution_maintenance_hr != null &&
    d.detail_problem_maintenance_hr != null
  );

  console.log(`\n有効データ数: ${valid.length}`);

  const formulas: { name: string; calc: (d: any) => number; matchRate?: number }[] = [];

  // HR系
  formulas.push({
    name: 'solution_maintenance_hr [0.5刻み]',
    calc: (d) => Math.round(d.detail_solution_maintenance_hr / 0.5) * 0.5
  });

  formulas.push({
    name: '(problem_hr + solution_hr) / 2 [0.5刻み]',
    calc: (d) => Math.round((d.detail_problem_maintenance_hr + d.detail_solution_maintenance_hr) / 2 / 0.5) * 0.5
  });

  // 全HR系
  formulas.push({
    name: '全HR系4項目平均 [0.5刻み]',
    calc: (d) => {
      const avg = (d.detail_problem_maintenance_hr + d.detail_problem_reform_hr +
        d.detail_solution_maintenance_hr + d.detail_solution_reform_hr) / 4;
      return Math.round(avg / 0.5) * 0.5;
    }
  });

  // solution_hrを優先
  formulas.push({
    name: 'solution_maintenance_hr + 0.5 [0.5刻み,max4]',
    calc: (d) => Math.min(4, Math.round((d.detail_solution_maintenance_hr + 0.5) / 0.5) * 0.5)
  });

  // 各式の一致率を計算
  for (const formula of formulas) {
    let match = 0;
    for (const d of valid) {
      const predicted = formula.calc(d);
      const actual = d.score_development;
      if (Math.abs(predicted - actual) < 0.01) {
        match++;
      }
    }
    formula.matchRate = match / valid.length * 100;
  }

  formulas.sort((a, b) => (b.matchRate || 0) - (a.matchRate || 0));

  console.log('\n計算式の一致率ランキング:');
  for (const formula of formulas.slice(0, 10)) {
    console.log(`  ${formula.matchRate!.toFixed(1)}% : ${formula.name}`);
  }
}

findExactFormula().catch(console.error);
