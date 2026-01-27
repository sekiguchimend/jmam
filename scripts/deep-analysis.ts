// 深い分析：各子スコアの重みや条件を探る
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function deepAnalysis() {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) {
    console.error('Error:', error);
    return;
  }

  // ========================================
  // 問題把握：同じ合計で親が違う理由を探る
  // ========================================
  console.log('=== 問題把握：子スコアごとの重み分析 ===\n');

  const problemValid = data.filter(d =>
    d.score_problem != null &&
    d.detail_problem_understanding != null &&
    d.detail_problem_essence != null &&
    d.detail_problem_maintenance_biz != null &&
    d.detail_problem_maintenance_hr != null &&
    d.detail_problem_reform_biz != null &&
    d.detail_problem_reform_hr != null
  );

  const childNames = ['understanding', 'essence', 'maint_biz', 'maint_hr', 'reform_biz', 'reform_hr'];
  const childFields = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  // 各子スコアが親スコアにどれだけ影響するか
  console.log('【各子スコアが1上がると、親スコアはいくつ上がるか】\n');

  for (let i = 0; i < childFields.length; i++) {
    const field = childFields[i];
    const name = childNames[i];

    // 他の子スコアが同じで、この子スコアだけ違うケースを探す
    const byOthers = new Map<string, { childVal: number; parent: number }[]>();

    for (const d of problemValid) {
      const others = childFields.filter((_, j) => j !== i).map(f => d[f]).join(',');
      const childVal = d[field];
      const parent = d.score_problem;

      if (!byOthers.has(others)) {
        byOthers.set(others, []);
      }
      byOthers.get(others)!.push({ childVal, parent });
    }

    // 同じ「他の子スコア」で、この子スコアが違うケースの親スコア差を計算
    let totalDiff = 0;
    let count = 0;

    for (const [, items] of byOthers.entries()) {
      if (items.length < 2) continue;

      // 子スコアでソート
      items.sort((a, b) => a.childVal - b.childVal);

      for (let j = 1; j < items.length; j++) {
        const prev = items[j - 1];
        const curr = items[j];
        if (curr.childVal > prev.childVal) {
          const childDiff = curr.childVal - prev.childVal;
          const parentDiff = curr.parent - prev.parent;
          totalDiff += parentDiff / childDiff;
          count++;
        }
      }
    }

    const avgImpact = count > 0 ? totalDiff / count : 0;
    console.log(`${name.padEnd(12)}: 子+1 → 親+${avgImpact.toFixed(3)} (${count}ペア)`);
  }

  // 特定の子スコアの値による分岐を探る
  console.log('\n【特定の子スコアが高い/低いと親スコアが変わるか】\n');

  for (let i = 0; i < childFields.length; i++) {
    const field = childFields[i];
    const name = childNames[i];

    // この子スコアが1,2,3,4のときの親スコア平均
    const byVal = new Map<number, number[]>();
    for (const d of problemValid) {
      const val = d[field];
      if (!byVal.has(val)) byVal.set(val, []);
      byVal.get(val)!.push(d.score_problem);
    }

    const avgs = Array.from(byVal.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([val, parents]) => `${val}→${(parents.reduce((a, b) => a + b, 0) / parents.length).toFixed(2)}`);

    console.log(`${name.padEnd(12)}: ${avgs.join(', ')}`);
  }

  // 合計が同じケースで、何が違うと親が変わるか
  console.log('\n【合計11: 親が2.0と2.5の違い】\n');

  const sum11 = problemValid.filter(d => {
    const sum = childFields.reduce((acc, f) => acc + d[f], 0);
    return sum === 11;
  });

  const parent2 = sum11.filter(d => d.score_problem === 2);
  const parent25 = sum11.filter(d => d.score_problem === 2.5);

  console.log(`親=2.0: ${parent2.length}件`);
  console.log(`親=2.5: ${parent25.length}件`);

  // 各子スコアの平均を比較
  console.log('\n子スコア平均の比較:');
  for (let i = 0; i < childFields.length; i++) {
    const field = childFields[i];
    const name = childNames[i];

    const avg2 = parent2.reduce((acc, d) => acc + d[field], 0) / parent2.length;
    const avg25 = parent25.reduce((acc, d) => acc + d[field], 0) / parent25.length;

    const diff = avg25 - avg2;
    const marker = Math.abs(diff) > 0.3 ? '★' : '';

    console.log(`  ${name.padEnd(12)}: 親2.0=${avg2.toFixed(2)}, 親2.5=${avg25.toFixed(2)}, 差=${diff.toFixed(2)} ${marker}`);
  }

  // 合計15も同様に
  console.log('\n【合計15: 親が2.5と3.0の違い】\n');

  const sum15 = problemValid.filter(d => {
    const sum = childFields.reduce((acc, f) => acc + d[f], 0);
    return sum === 15;
  });

  const parent25_15 = sum15.filter(d => d.score_problem === 2.5);
  const parent3 = sum15.filter(d => d.score_problem === 3);

  console.log(`親=2.5: ${parent25_15.length}件`);
  console.log(`親=3.0: ${parent3.length}件`);

  console.log('\n子スコア平均の比較:');
  for (let i = 0; i < childFields.length; i++) {
    const field = childFields[i];
    const name = childNames[i];

    const avg25 = parent25_15.reduce((acc, d) => acc + d[field], 0) / parent25_15.length;
    const avg3 = parent3.reduce((acc, d) => acc + d[field], 0) / parent3.length;

    const diff = avg3 - avg25;
    const marker = Math.abs(diff) > 0.3 ? '★' : '';

    console.log(`  ${name.padEnd(12)}: 親2.5=${avg25.toFixed(2)}, 親3.0=${avg3.toFixed(2)}, 差=${diff.toFixed(2)} ${marker}`);
  }

  // 重み付き計算式を試す
  console.log('\n\n=== 重み付き計算式の探索 ===\n');

  // グリッドサーチで最適な重みを探す
  let bestWeights: number[] = [];
  let bestAccuracy = 0;

  const step = 0.1;
  for (let w0 = 0; w0 <= 1; w0 += step) {
    for (let w1 = 0; w1 <= 1 - w0; w1 += step) {
      for (let w2 = 0; w2 <= 1 - w0 - w1; w2 += step) {
        for (let w3 = 0; w3 <= 1 - w0 - w1 - w2; w3 += step) {
          for (let w4 = 0; w4 <= 1 - w0 - w1 - w2 - w3; w4 += step) {
            const w5 = 1 - w0 - w1 - w2 - w3 - w4;
            if (w5 < 0) continue;

            const weights = [w0, w1, w2, w3, w4, w5];

            // この重みで計算
            let match = 0;
            for (const d of problemValid) {
              const weightedSum = childFields.reduce((acc, f, i) => acc + d[f] * weights[i], 0);
              const predicted = Math.round((weightedSum / 4) * 5 * 2) / 2;
              const clamped = Math.min(5, Math.max(1, predicted));
              if (Math.abs(clamped - d.score_problem) < 0.01) match++;
            }

            const accuracy = match / problemValid.length;
            if (accuracy > bestAccuracy) {
              bestAccuracy = accuracy;
              bestWeights = weights;
            }
          }
        }
      }
    }
  }

  console.log(`最適な重み (一致率=${(bestAccuracy * 100).toFixed(1)}%):`);
  for (let i = 0; i < childNames.length; i++) {
    console.log(`  ${childNames[i].padEnd(12)}: ${bestWeights[i].toFixed(2)}`);
  }

  // 閾値ベースのルールを試す
  console.log('\n\n=== 閾値ベースのルール探索 ===\n');

  // 本質把握が3以上なら+0.5みたいなルール
  let bestRule = '';
  let bestRuleAccuracy = 0;

  for (let i = 0; i < childFields.length; i++) {
    for (let threshold = 2; threshold <= 3; threshold++) {
      for (const bonus of [0.5, -0.5]) {
        let match = 0;
        for (const d of problemValid) {
          const sum = childFields.reduce((acc, f) => acc + d[f], 0);
          let predicted = Math.round((sum / 6 / 4) * 5 * 2) / 2;

          if (d[childFields[i]] >= threshold) {
            predicted += bonus;
          }

          predicted = Math.min(5, Math.max(1, predicted));
          predicted = Math.round(predicted * 2) / 2;

          if (Math.abs(predicted - d.score_problem) < 0.01) match++;
        }

        const accuracy = match / problemValid.length;
        if (accuracy > bestRuleAccuracy) {
          bestRuleAccuracy = accuracy;
          bestRule = `${childNames[i]} >= ${threshold} なら ${bonus > 0 ? '+' : ''}${bonus}`;
        }
      }
    }
  }

  console.log(`最適な閾値ルール: ${bestRule}`);
  console.log(`一致率: ${(bestRuleAccuracy * 100).toFixed(1)}%`);

  // 複合ルールを試す
  console.log('\n=== 複合ルール探索 ===\n');

  // 基本式 + 条件
  const rules = [
    {
      name: '基本式（合計/6*1.25を0.5刻み）',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        return Math.round((sum / 6 / 4) * 5 * 2) / 2;
      }
    },
    {
      name: '本質>=理解なら+0.5',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        let pred = Math.round((sum / 6 / 4) * 5 * 2) / 2;
        if (d.detail_problem_essence >= d.detail_problem_understanding) {
          pred = Math.min(5, pred + 0.5);
        }
        return pred;
      }
    },
    {
      name: '理解>=3なら切り捨て',
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
      name: '本質>=2なら四捨五入、それ以外は切り捨て',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;
        if (d.detail_problem_essence >= 2) {
          return Math.round(raw / 0.5) * 0.5;
        }
        return Math.floor(raw / 0.5) * 0.5;
      }
    },
    {
      name: '(理解+本質)/2 + (他4つの平均) を1.25倍',
      calc: (d: any) => {
        const base = (d.detail_problem_understanding + d.detail_problem_essence) / 2;
        const others = (d.detail_problem_maintenance_biz + d.detail_problem_maintenance_hr +
          d.detail_problem_reform_biz + d.detail_problem_reform_hr) / 4;
        const total = (base + others) / 2;
        return Math.round((total / 4) * 5 * 2) / 2;
      }
    },
    {
      name: 'max(理解,本質)*0.3 + 他の平均*0.7 を1.25倍',
      calc: (d: any) => {
        const maxUE = Math.max(d.detail_problem_understanding, d.detail_problem_essence);
        const others = (d.detail_problem_maintenance_biz + d.detail_problem_maintenance_hr +
          d.detail_problem_reform_biz + d.detail_problem_reform_hr) / 4;
        const total = maxUE * 0.3 + others * 0.7;
        return Math.round((total / 4) * 5 * 2) / 2;
      }
    },
  ];

  for (const rule of rules) {
    let match = 0;
    for (const d of problemValid) {
      const predicted = rule.calc(d);
      if (Math.abs(predicted - d.score_problem) < 0.01) match++;
    }
    const accuracy = match / problemValid.length;
    console.log(`${(accuracy * 100).toFixed(1)}% : ${rule.name}`);
  }

  // 連携も同様に
  console.log('\n\n=== 連携の詳細分析 ===\n');

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
      name: '(上司+職場外)/2 + メンバー*0.2',
      calc: (d: any) => {
        const base = (d.detail_collab_supervisor + d.detail_collab_external) / 2;
        return Math.round((base + d.detail_collab_member * 0.2) * 2) / 2;
      }
    },
    {
      name: 'max(上司,職場外) + 0.5',
      calc: (d: any) => {
        const maxVal = Math.max(d.detail_collab_supervisor, d.detail_collab_external);
        return Math.round((maxVal + 0.5) * 2) / 2;
      }
    },
    {
      name: '上司*0.4 + 職場外*0.4 + メンバー*0.2 + 0.5',
      calc: (d: any) => {
        const weighted = d.detail_collab_supervisor * 0.4 +
          d.detail_collab_external * 0.4 +
          d.detail_collab_member * 0.2;
        return Math.round((weighted + 0.5) * 2) / 2;
      }
    },
    {
      name: '上司>=2なら(合計/2)、それ以外は(合計/2-0.5)',
      calc: (d: any) => {
        const sum = d.detail_collab_supervisor + d.detail_collab_external + d.detail_collab_member;
        if (d.detail_collab_supervisor >= 2) {
          return Math.round(sum / 2 * 2) / 2;
        }
        return sum / 2 - 0.5;
      }
    },
  ];

  for (const rule of collabRules) {
    let match = 0;
    for (const d of collabValid) {
      const predicted = Math.min(4, Math.max(1, rule.calc(d)));
      const rounded = Math.round(predicted * 2) / 2;
      if (Math.abs(rounded - d.score_collaboration) < 0.01) match++;
    }
    const accuracy = match / collabValid.length;
    console.log(`${(accuracy * 100).toFixed(1)}% : ${rule.name}`);
  }
}

deepAnalysis().catch(console.error);
