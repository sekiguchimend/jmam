// 他の主要スコアが影響しているか確認
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function crossScoreEffect() {
  const { data, error } = await supabase
    .from('responses')
    .select('*')
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error || !data) return;

  console.log('=== 他のスコアが影響しているか確認 ===\n');

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
    d.score_solution != null &&
    childFields.every(f => d[f] != null)
  );

  console.log(`データ数: ${problemValid.length}\n`);

  // 仮説: 対策立案スコアが高いと、問題把握も高くなる
  console.log('【仮説: 対策立案スコアが問題把握に影響する】\n');

  // 同じ子スコア合計でも、対策立案が高いと親が高いか？
  const bySum = new Map<number, any[]>();
  for (const d of problemValid) {
    const sum = childFields.reduce((acc, f) => acc + d[f], 0);
    if (!bySum.has(sum)) bySum.set(sum, []);
    bySum.get(sum)!.push(d);
  }

  for (const [sum, items] of Array.from(bySum.entries()).sort((a, b) => a[0] - b[0])) {
    if (items.length < 10) continue;

    // 対策立案スコアと問題把握スコアの相関
    const solScores = items.map(d => d.score_solution);
    const probScores = items.map(d => d.score_problem);

    const corr = calculateCorrelation(solScores, probScores);
    console.log(`合計${sum} (${items.length}件): 対策立案との相関 = ${corr.toFixed(3)}`);
  }

  // 対策立案を組み込んだ計算式
  console.log('\n\n【対策立案を組み込んだ計算式】\n');

  const rules = [
    {
      name: '基本式（四捨五入）',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        return Math.round((sum / 6 / 4) * 5 / 0.5) * 0.5;
      }
    },
    {
      name: '基本式 + 対策立案>=2.5なら+0.5',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        let result = Math.round((sum / 6 / 4) * 5 / 0.5) * 0.5;
        if (d.score_solution >= 2.5) {
          result += 0.5;
        }
        return Math.min(5, result);
      }
    },
    {
      name: '条件付きルール + 対策立案>=問題把握なら四捨五入に戻す',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const raw = (sum / 6 / 4) * 5;

        // 基本条件
        const shouldFloor = d.detail_problem_understanding >= 3 &&
                           d.detail_problem_essence < d.detail_problem_understanding;

        // 対策立案が高ければ四捨五入に戻す
        if (shouldFloor && d.score_solution >= 2.5) {
          return Math.round(raw / 0.5) * 0.5;
        }
        if (shouldFloor) {
          return Math.floor(raw / 0.5) * 0.5;
        }
        return Math.round(raw / 0.5) * 0.5;
      }
    },
    {
      name: '(子合計 + 対策立案*2) / 8 * 5',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const combined = sum + d.score_solution * 2;
        return Math.round((combined / 8 / 4) * 5 / 0.5) * 0.5;
      }
    },
    {
      name: '子合計から計算 + 対策立案との平均',
      calc: (d: any) => {
        const sum = childFields.reduce((acc, f) => acc + d[f], 0);
        const fromChildren = (sum / 6 / 4) * 5;
        const avg = (fromChildren + d.score_solution) / 2;
        return Math.round(avg / 0.5) * 0.5;
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

  // もっと根本的に考える: 問題把握は対策立案と連動しているのでは？
  console.log('\n\n【根本的な仮説: 問題把握≒対策立案？】\n');

  let matchSame = 0;
  let matchSameRounded = 0;
  for (const d of problemValid) {
    if (d.score_problem === d.score_solution) matchSame++;
    if (Math.abs(d.score_problem - d.score_solution) <= 0.5) matchSameRounded++;
  }

  console.log(`完全一致: ${(matchSame / problemValid.length * 100).toFixed(1)}%`);
  console.log(`±0.5以内: ${(matchSameRounded / problemValid.length * 100).toFixed(1)}%`);

  // 対策立案と問題把握の関係
  console.log('\n問題把握 vs 対策立案 のクロス集計:');
  const cross = new Map<string, number>();
  for (const d of problemValid) {
    const key = `問${d.score_problem}-策${d.score_solution}`;
    cross.set(key, (cross.get(key) || 0) + 1);
  }

  const sortedCross = Array.from(cross.entries()).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedCross.slice(0, 20)) {
    console.log(`  ${key}: ${count}件`);
  }

  // 連携も同様に
  console.log('\n\n=== 連携の分析 ===\n');

  const collabFields = ['detail_collab_supervisor', 'detail_collab_external', 'detail_collab_member'];
  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    collabFields.every(f => d[f] != null) &&
    d.score_solution != null
  );

  // 連携と対策立案の関係
  console.log('連携 vs 対策立案 のクロス集計:');
  const collabCross = new Map<string, number>();
  for (const d of collabValid) {
    const key = `連${d.score_collaboration}-策${d.score_solution}`;
    collabCross.set(key, (collabCross.get(key) || 0) + 1);
  }

  const sortedCollabCross = Array.from(collabCross.entries()).sort((a, b) => b[1] - a[1]);
  for (const [key, count] of sortedCollabCross.slice(0, 15)) {
    console.log(`  ${key}: ${count}件`);
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
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

  return num / Math.sqrt(denomX * denomY);
}

crossScoreEffect().catch(console.error);
