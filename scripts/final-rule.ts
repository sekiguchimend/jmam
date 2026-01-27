// 最終ルール探索
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function finalRule() {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) return;

  const problemValid = data.filter(d =>
    d.score_problem != null &&
    d.detail_problem_understanding != null &&
    d.detail_problem_essence != null &&
    d.detail_problem_maintenance_biz != null &&
    d.detail_problem_maintenance_hr != null &&
    d.detail_problem_reform_biz != null &&
    d.detail_problem_reform_hr != null
  );

  console.log('=== 問題把握の最終ルール探索 ===\n');
  console.log(`データ数: ${problemValid.length}\n`);

  const childFields = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  // 発見：理解>=3なら切り捨て → もっと詳しく
  console.log('【理解の値による丸め方の違い】\n');

  for (let u = 1; u <= 4; u++) {
    const subset = problemValid.filter(d => d.detail_problem_understanding === u);
    console.log(`理解=${u}: ${subset.length}件`);

    // この理解値で、四捨五入と切り捨ての一致率を比較
    let matchRound = 0;
    let matchFloor = 0;
    let matchCeil = 0;

    for (const d of subset) {
      const sum = childFields.reduce((acc, f) => acc + d[f], 0);
      const raw = (sum / 6 / 4) * 5;

      const rounded = Math.round(raw / 0.5) * 0.5;
      const floored = Math.floor(raw / 0.5) * 0.5;
      const ceiled = Math.ceil(raw / 0.5) * 0.5;

      if (Math.abs(rounded - d.score_problem) < 0.01) matchRound++;
      if (Math.abs(floored - d.score_problem) < 0.01) matchFloor++;
      if (Math.abs(ceiled - d.score_problem) < 0.01) matchCeil++;
    }

    console.log(`  四捨五入: ${(matchRound / subset.length * 100).toFixed(1)}%`);
    console.log(`  切り捨て: ${(matchFloor / subset.length * 100).toFixed(1)}%`);
    console.log(`  切り上げ: ${(matchCeil / subset.length * 100).toFixed(1)}%`);
  }

  // 本質把握も同様に
  console.log('\n【本質の値による丸め方の違い】\n');

  for (let e = 1; e <= 3; e++) {
    const subset = problemValid.filter(d => d.detail_problem_essence === e);
    console.log(`本質=${e}: ${subset.length}件`);

    let matchRound = 0;
    let matchFloor = 0;

    for (const d of subset) {
      const sum = childFields.reduce((acc, f) => acc + d[f], 0);
      const raw = (sum / 6 / 4) * 5;

      const rounded = Math.round(raw / 0.5) * 0.5;
      const floored = Math.floor(raw / 0.5) * 0.5;

      if (Math.abs(rounded - d.score_problem) < 0.01) matchRound++;
      if (Math.abs(floored - d.score_problem) < 0.01) matchFloor++;
    }

    console.log(`  四捨五入: ${(matchRound / subset.length * 100).toFixed(1)}%`);
    console.log(`  切り捨て: ${(matchFloor / subset.length * 100).toFixed(1)}%`);
  }

  // 複合条件を試す
  console.log('\n\n=== 複合条件ルール ===\n');

  const rules = [
    {
      name: '理解>=3 → 切り捨て、それ以外 → 四捨五入',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding >= 3) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '理解>=4 → 切り捨て、それ以外 → 四捨五入',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding >= 4) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '理解>本質 → 切り捨て、それ以外 → 四捨五入',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding > d.detail_problem_essence) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '理解-本質>=2 → 切り捨て、それ以外 → 四捨五入',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding - d.detail_problem_essence >= 2) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '本質==1 → 切り捨て、それ以外 → 四捨五入',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_essence === 1) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '(理解>=3 && 本質<=2) → 切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding >= 3 && d.detail_problem_essence <= 2) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '維持系合計 >= 改革系合計 → 切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        const maint = d.detail_problem_maintenance_biz + d.detail_problem_maintenance_hr;
        const reform = d.detail_problem_reform_biz + d.detail_problem_reform_hr;
        if (maint >= reform) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
  ];

  for (const rule of rules) {
    let match = 0;
    for (const d of problemValid) {
      const predicted = rule.calc(d);
      if (Math.abs(predicted - d.score_problem) < 0.01) match++;
    }
    console.log(`${(match / problemValid.length * 100).toFixed(1)}% : ${rule.name}`);
  }

  // さらに精度を上げるルールを探索
  console.log('\n\n=== さらに詳細なルール探索 ===\n');

  // 「理解>=3なら切り捨て」で不一致のケースを分析
  const baseRule = (d: any) => {
    const sum = childFields.reduce((acc, f) => acc + d[f], 0);
    const raw = (sum / 6 / 4) * 5;
    if (d.detail_problem_understanding >= 3) {
      return Math.floor(raw / 0.5) * 0.5;
    }
    return Math.round(raw / 0.5) * 0.5;
  };

  const mismatches: any[] = [];
  for (const d of problemValid) {
    const predicted = baseRule(d);
    if (Math.abs(predicted - d.score_problem) >= 0.01) {
      mismatches.push({
        ...d,
        predicted,
        diff: d.score_problem - predicted
      });
    }
  }

  console.log(`基本ルール（理解>=3なら切り捨て）の不一致: ${mismatches.length}件\n`);

  // 不一致の傾向を分析
  const byDiff = new Map<number, any[]>();
  for (const m of mismatches) {
    const diff = m.diff;
    if (!byDiff.has(diff)) byDiff.set(diff, []);
    byDiff.get(diff)!.push(m);
  }

  for (const [diff, items] of Array.from(byDiff.entries()).sort((a, b) => a[0] - b[0])) {
    console.log(`差=${diff}: ${items.length}件`);

    // 共通パターンを探す
    const patterns = new Map<string, number>();
    for (const item of items) {
      const pattern = `理解=${item.detail_problem_understanding},本質=${item.detail_problem_essence}`;
      patterns.set(pattern, (patterns.get(pattern) || 0) + 1);
    }

    const sorted = Array.from(patterns.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
    for (const [pattern, count] of sorted) {
      console.log(`  ${pattern}: ${count}件`);
    }
  }

  // 最終ルール
  console.log('\n\n=== 最終ルール ===\n');

  const finalRules = [
    {
      name: '理解>=3 → 切り捨て + (理解=1かつ本質=1なら+0.5)',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        let result;
        if (d.detail_problem_understanding >= 3) {
          result = Math.floor(raw / 0.5) * 0.5;
        } else {
          result = Math.round(raw / 0.5) * 0.5;
        }

        // 追加ルール
        if (d.detail_problem_understanding === 1 && d.detail_problem_essence === 1) {
          result += 0.5;
        }

        return Math.min(5, Math.max(1, result));
      }
    },
    {
      name: '理解>=3かつ本質<理解 → 切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_understanding >= 3 &&
          d.detail_problem_essence < d.detail_problem_understanding) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
  ];

  for (const rule of finalRules) {
    let match = 0;
    for (const d of problemValid) {
      const predicted = rule.calc(d);
      if (Math.abs(predicted - d.score_problem) < 0.01) match++;
    }
    console.log(`${(match / problemValid.length * 100).toFixed(1)}% : ${rule.name}`);
  }

  // ===== 対策立案も同様に =====
  console.log('\n\n=== 対策立案の分析 ===\n');

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
      name: '基本（四捨五入）',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        return Math.round((sum / 6 / 4) * 5 / 0.5) * 0.5;
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
      name: '網羅性>=4 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_coverage >= 4) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '計画性==1 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_planning === 1) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '網羅性>計画性 → 切り捨て',
      calc: (d: any) => {
        const sum = solFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_solution_coverage > d.detail_solution_planning) {
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
}

finalRule().catch(console.error);
