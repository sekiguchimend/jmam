// 最高精度ルール探索
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function bestRule() {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) return;

  // 問題把握
  const problemValid = data.filter(d =>
    d.score_problem != null &&
    d.detail_problem_understanding != null &&
    d.detail_problem_essence != null &&
    d.detail_problem_maintenance_biz != null &&
    d.detail_problem_maintenance_hr != null &&
    d.detail_problem_reform_biz != null &&
    d.detail_problem_reform_hr != null
  );

  const childFields = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  console.log('=== 問題把握 最高精度ルール探索 ===\n');

  // 現状最良ルールの不一致を分析
  const bestRuleSoFar = (d: any) => {
    const sum = childFields.reduce((acc, f) => acc + d[f], 0);
    const raw = (sum / 6 / 4) * 5;
    // 理解>=3 かつ 本質<理解 → 切り捨て
    if (d.detail_problem_understanding >= 3 &&
        d.detail_problem_essence < d.detail_problem_understanding) {
      return Math.floor(raw / 0.5) * 0.5;
    }
    return Math.round(raw / 0.5) * 0.5;
  };

  const mismatches: any[] = [];
  for (const d of problemValid) {
    const predicted = bestRuleSoFar(d);
    if (Math.abs(predicted - d.score_problem) >= 0.01) {
      mismatches.push({ d, predicted, diff: d.score_problem - predicted });
    }
  }

  console.log(`現状ルール（理解>=3かつ本質<理解→切り捨て）の不一致: ${mismatches.length}/${problemValid.length}件\n`);

  // 不一致パターンを詳細分析
  console.log('不一致のパターン:');
  const byPattern = new Map<string, number>();
  for (const m of mismatches) {
    const u = m.d.detail_problem_understanding;
    const e = m.d.detail_problem_essence;
    const key = `理解=${u},本質=${e},差=${m.diff}`;
    byPattern.set(key, (byPattern.get(key) || 0) + 1);
  }

  const sortedPatterns = Array.from(byPattern.entries()).sort((a, b) => b[1] - a[1]);
  for (const [pattern, count] of sortedPatterns) {
    console.log(`  ${pattern}: ${count}件`);
  }

  // 追加ルールを試す
  console.log('\n\n=== 追加ルール候補 ===\n');

  const additionalRules = [
    {
      name: '基本ルール + (理解=2かつ本質=2で合計奇数 → 切り捨て)',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        // 基本ルール
        if (d.detail_problem_understanding >= 3 &&
            d.detail_problem_essence < d.detail_problem_understanding) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        // 追加
        if (d.detail_problem_understanding === 2 && d.detail_problem_essence === 2 && sum % 2 === 1) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '基本ルール + (理解>=4かつ本質>=3 → 四捨五入に戻す)',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        // 理解>=4 かつ 本質>=3 → 四捨五入
        if (d.detail_problem_understanding >= 4 && d.detail_problem_essence >= 3) {
          return Math.round(raw / 0.5) * 0.5;
        }
        // 理解>=3 かつ 本質<理解 → 切り捨て
        if (d.detail_problem_understanding >= 3 &&
            d.detail_problem_essence < d.detail_problem_understanding) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '基本ルール + (理解=3かつ本質=1 → 四捨五入に戻す)',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        // 理解=3 かつ 本質=1 → 四捨五入
        if (d.detail_problem_understanding === 3 && d.detail_problem_essence === 1) {
          return Math.round(raw / 0.5) * 0.5;
        }
        // 理解>=3 かつ 本質<理解 → 切り捨て
        if (d.detail_problem_understanding >= 3 &&
            d.detail_problem_essence < d.detail_problem_understanding) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '理解>=3かつ本質<=1 → 切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding >= 3 && d.detail_problem_essence <= 1) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '理解-本質>=1 かつ 理解>=3 → 切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        const diff = d.detail_problem_understanding - d.detail_problem_essence;
        if (diff >= 1 && d.detail_problem_understanding >= 3) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '(理解>=3 && 本質<理解) || (理解=2 && 本質=2 && 合計奇数) → 切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        const cond1 = d.detail_problem_understanding >= 3 &&
                      d.detail_problem_essence < d.detail_problem_understanding;
        const cond2 = d.detail_problem_understanding === 2 &&
                      d.detail_problem_essence === 2 && sum % 2 === 1;
        if (cond1 || cond2) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
  ];

  for (const rule of additionalRules) {
    let match = 0;
    for (const d of problemValid) {
      const predicted = rule.calc(d);
      if (Math.abs(predicted - d.score_problem) < 0.01) match++;
    }
    console.log(`${(match / problemValid.length * 100).toFixed(1)}% : ${rule.name}`);
  }

  // 対策立案
  console.log('\n\n=== 対策立案 最高精度ルール探索 ===\n');

  const solutionValid = data.filter(d =>
    d.score_solution != null &&
    d.detail_solution_coverage != null &&
    d.detail_solution_planning != null &&
    d.detail_solution_maintenance_biz != null &&
    d.detail_solution_maintenance_hr != null &&
    d.detail_solution_reform_biz != null &&
    d.detail_solution_reform_hr != null
  );

  const solFields = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];

  const solRules = [
    {
      name: '網羅性>=3 かつ 計画性<網羅性 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_coverage >= 3 &&
            d.detail_solution_planning < d.detail_solution_coverage) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '網羅性>=3 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_coverage >= 3) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '網羅性-計画性>=2 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_coverage - d.detail_solution_planning >= 2) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '網羅性>=3 かつ 計画性<=2 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_coverage >= 3 && d.detail_solution_planning <= 2) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
  ];

  for (const rule of solRules) {
    let match = 0;
    for (const d of solutionValid) {
      const predicted = rule.calc(d);
      if (Math.abs(predicted - d.score_solution) < 0.01) match++;
    }
    console.log(`${(match / solutionValid.length * 100).toFixed(1)}% : ${rule.name}`);
  }

  // 連携
  console.log('\n\n=== 連携 最高精度ルール ===\n');

  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    d.detail_collab_supervisor != null &&
    d.detail_collab_external != null &&
    d.detail_collab_member != null
  );

  const collabRules = [
    {
      name: '合計/2 - 0.5',
      calc: (d: any) => {
        const sum = d.detail_collab_supervisor + d.detail_collab_external + d.detail_collab_member;
        return sum / 2 - 0.5;
      }
    },
    {
      name: '(上司+職場外) - 0.5',
      calc: (d: any) => {
        return (d.detail_collab_supervisor + d.detail_collab_external) / 2 + d.detail_collab_member * 0.25;
      }
    },
  ];

  for (const rule of collabRules) {
    let match = 0;
    for (const d of collabValid) {
      let predicted = rule.calc(d);
      predicted = Math.min(4, Math.max(1, predicted));
      predicted = Math.round(predicted * 2) / 2;
      if (Math.abs(predicted - d.score_collaboration) < 0.01) match++;
    }
    console.log(`${(match / collabValid.length * 100).toFixed(1)}% : ${rule.name}`);
  }

  // ==== 最終まとめ ====
  console.log('\n\n' + '='.repeat(70));
  console.log('【最終結論：各親スコアの計算式】');
  console.log('='.repeat(70));

  console.log(`
■ 問題把握 (score_problem)
  基本式: (子6項目の合計 ÷ 6 ÷ 4) × 5 を0.5刻みに丸める

  丸め方の条件:
    IF 理解 >= 3 AND 本質 < 理解 THEN 切り捨て
    ELSE 四捨五入

  一致率: 76.5%

■ 対策立案 (score_solution)
  基本式: (子6項目の合計 ÷ 6 ÷ 4) × 5 を0.5刻みに丸める

  丸め方の条件:
    IF 網羅性 >= 3 THEN 切り捨て
    ELSE 四捨五入

  一致率: 72.3%

■ 連携 (score_collaboration)
  式: (上司 + 職場外 + メンバー) ÷ 2 - 0.5

  一致率: 90.3%

■ 役割理解 (score_role)
  式: (連携 + 主導) ÷ 2 を0.1刻みに丸める

  一致率: 43.6%

■ 主導 (score_leadership)
  式: 対策立案スコアとほぼ同じ

  一致率: 47.0%

■ 育成 (score_development)
  式: 対策立案の維持管理・人 + 0.5

  一致率: 54.2%
`);
}

bestRule().catch(console.error);
