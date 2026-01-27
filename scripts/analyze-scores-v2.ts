// スコア関係性分析スクリプト v2 - より詳細な計算式推定
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeScores() {
  console.log('=== スコア関係性 詳細分析 v2 ===\n');

  const { data, error } = await supabase
    .from('responses')
    .select(`
      id, case_id, response_id,
      score_problem, score_solution, score_role,
      score_leadership, score_collaboration, score_development,
      detail_problem_understanding, detail_problem_essence,
      detail_problem_maintenance_biz, detail_problem_maintenance_hr,
      detail_problem_reform_biz, detail_problem_reform_hr,
      detail_solution_coverage, detail_solution_planning,
      detail_solution_maintenance_biz, detail_solution_maintenance_hr,
      detail_solution_reform_biz, detail_solution_reform_hr,
      detail_collab_supervisor, detail_collab_external, detail_collab_member
    `)
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`総レコード数: ${data?.length || 0}\n`);
  if (!data || data.length === 0) return;

  // ========================================
  // 1. 問題把握スコアの計算法則を探る
  // ========================================
  console.log('='.repeat(60));
  console.log('【1. 問題把握 (score_problem) の計算法則】');
  console.log('='.repeat(60));

  const problemDetails = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];

  const problemValid = data.filter(d =>
    d.score_problem != null &&
    problemDetails.every(pd => (d as Record<string, unknown>)[pd] != null)
  );

  console.log(`有効データ数: ${problemValid.length}`);

  // 様々な計算式を試す
  testFormulas(problemValid, 'score_problem', problemDetails, 5);

  // ========================================
  // 2. 対策立案スコアの計算法則を探る
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('【2. 対策立案 (score_solution) の計算法則】');
  console.log('='.repeat(60));

  const solutionDetails = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];

  const solutionValid = data.filter(d =>
    d.score_solution != null &&
    solutionDetails.every(sd => (d as Record<string, unknown>)[sd] != null)
  );

  console.log(`有効データ数: ${solutionValid.length}`);
  testFormulas(solutionValid, 'score_solution', solutionDetails, 5);

  // ========================================
  // 3. 連携スコアの計算法則を探る
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('【3. 連携 (score_collaboration) の計算法則】');
  console.log('='.repeat(60));

  const collabDetails = [
    'detail_collab_supervisor',
    'detail_collab_external',
    'detail_collab_member'
  ];

  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    collabDetails.every(cd => (d as Record<string, unknown>)[cd] != null)
  );

  console.log(`有効データ数: ${collabValid.length}`);
  testFormulas(collabValid, 'score_collaboration', collabDetails, 4);

  // ========================================
  // 4. 役割理解・主導・育成の法則を探る
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('【4. 役割理解・主導・育成 の計算法則】');
  console.log('='.repeat(60));

  // これらは詳細スコアがないので、他の主要スコアとの関係を分析
  analyzeIndependentScores(data);

  // ========================================
  // 5. 具体的なデータパターン分析
  // ========================================
  console.log('\n' + '='.repeat(60));
  console.log('【5. データパターン分析】');
  console.log('='.repeat(60));

  analyzePatterns(problemValid, 'score_problem', problemDetails);
  analyzePatterns(solutionValid, 'score_solution', solutionDetails);
  analyzePatterns(collabValid, 'score_collaboration', collabDetails);
}

function testFormulas(data: any[], mainScore: string, detailScores: string[], mainMax: number) {
  const detailMax = 4;

  // 実際の値
  const actual = data.map(d => d[mainScore]);

  // テスト1: 単純平均
  console.log('\n--- テスト1: 単純平均 ---');
  const predicted1 = data.map(d => {
    const sum = detailScores.reduce((acc, ds) => acc + (d[ds] || 0), 0);
    return sum / detailScores.length;
  });
  const error1 = calculateErrors(actual, predicted1);
  console.log(`  予測式: (詳細スコアの合計) / ${detailScores.length}`);
  console.log(`  MAE: ${error1.mae.toFixed(4)}, RMSE: ${error1.rmse.toFixed(4)}, R²: ${error1.r2.toFixed(4)}`);

  // テスト2: 平均をスケール変換（4点→5点）
  console.log('\n--- テスト2: 平均をスケール変換 (4点→主要スコール) ---');
  const predicted2 = data.map(d => {
    const sum = detailScores.reduce((acc, ds) => acc + (d[ds] || 0), 0);
    const avg = sum / detailScores.length;
    return (avg / detailMax) * mainMax;
  });
  const error2 = calculateErrors(actual, predicted2);
  console.log(`  予測式: (詳細スコアの平均 / ${detailMax}) × ${mainMax}`);
  console.log(`  MAE: ${error2.mae.toFixed(4)}, RMSE: ${error2.rmse.toFixed(4)}, R²: ${error2.r2.toFixed(4)}`);

  // テスト3: 合計をスケール変換
  console.log('\n--- テスト3: 合計をスケール変換 ---');
  const maxSum = detailScores.length * detailMax;
  const predicted3 = data.map(d => {
    const sum = detailScores.reduce((acc, ds) => acc + (d[ds] || 0), 0);
    return (sum / maxSum) * mainMax;
  });
  const error3 = calculateErrors(actual, predicted3);
  console.log(`  予測式: (詳細スコアの合計 / ${maxSum}) × ${mainMax}`);
  console.log(`  MAE: ${error3.mae.toFixed(4)}, RMSE: ${error3.rmse.toFixed(4)}, R²: ${error3.r2.toFixed(4)}`);

  // テスト4: 0.5刻みに丸め
  console.log('\n--- テスト4: 0.5刻みに丸め後 ---');
  const predicted4 = data.map(d => {
    const sum = detailScores.reduce((acc, ds) => acc + (d[ds] || 0), 0);
    const avg = sum / detailScores.length;
    const scaled = (avg / detailMax) * mainMax;
    return Math.round(scaled * 2) / 2; // 0.5刻みに丸め
  });
  const error4 = calculateErrors(actual, predicted4);
  console.log(`  予測式: round((詳細スコアの平均 / ${detailMax}) × ${mainMax} × 2) / 2`);
  console.log(`  MAE: ${error4.mae.toFixed(4)}, RMSE: ${error4.rmse.toFixed(4)}, R²: ${error4.r2.toFixed(4)}`);

  // テスト5: グループ別の重み付け（維持管理系 vs 改革系）
  if (mainScore === 'score_problem' || mainScore === 'score_solution') {
    console.log('\n--- テスト5: グループ別重み付け ---');

    // 維持管理系と改革系を分ける
    const prefix = mainScore === 'score_problem' ? 'detail_problem_' : 'detail_solution_';

    const predicted5 = data.map(d => {
      const understanding = d[prefix + 'understanding'] || d[prefix + 'coverage'] || 0;
      const essence = d[prefix + 'essence'] || d[prefix + 'planning'] || 0;
      const maintBiz = d[prefix + 'maintenance_biz'] || 0;
      const maintHr = d[prefix + 'maintenance_hr'] || 0;
      const reformBiz = d[prefix + 'reform_biz'] || 0;
      const reformHr = d[prefix + 'reform_hr'] || 0;

      // 基本系（理解・本質 or 網羅性・計画性）と業務系を重み付け
      const base = (understanding + essence) / 2;
      const maint = (maintBiz + maintHr) / 2;
      const reform = (reformBiz + reformHr) / 2;

      // 均等重み
      const total = (base + maint + reform) / 3;
      return (total / detailMax) * mainMax;
    });
    const error5 = calculateErrors(actual, predicted5);
    console.log(`  予測式: ((基本系平均 + 維持管理系平均 + 改革系平均) / 3 / ${detailMax}) × ${mainMax}`);
    console.log(`  MAE: ${error5.mae.toFixed(4)}, RMSE: ${error5.rmse.toFixed(4)}, R²: ${error5.r2.toFixed(4)}`);
  }

  // テスト6: 最適な重みを探索
  console.log('\n--- テスト6: 最適な線形結合（正規化制約付き）---');
  const weights = findOptimalWeights(data, mainScore, detailScores);
  console.log(`  最適重み: ${weights.map((w, i) => `${detailScores[i].replace('detail_', '').replace('problem_', 'p_').replace('solution_', 's_').replace('collab_', 'c_')}=${w.toFixed(3)}`).join(', ')}`);

  const predicted6 = data.map(d => {
    let sum = 0;
    for (let i = 0; i < detailScores.length; i++) {
      sum += weights[i] * (d[detailScores[i]] || 0);
    }
    return sum;
  });
  const error6 = calculateErrors(actual, predicted6);
  console.log(`  MAE: ${error6.mae.toFixed(4)}, RMSE: ${error6.rmse.toFixed(4)}, R²: ${error6.r2.toFixed(4)}`);

  // 完全一致率を計算
  console.log('\n--- 完全一致率 ---');
  let exactMatch = 0;
  for (let i = 0; i < data.length; i++) {
    if (Math.abs(actual[i] - predicted4[i]) < 0.01) {
      exactMatch++;
    }
  }
  console.log(`  テスト4（0.5刻み丸め）の完全一致率: ${(exactMatch / data.length * 100).toFixed(1)}%`);
}

function calculateErrors(actual: number[], predicted: number[]) {
  const n = actual.length;
  let sumAE = 0;
  let sumSE = 0;
  const meanActual = actual.reduce((a, b) => a + b, 0) / n;
  let ssTot = 0;
  let ssRes = 0;

  for (let i = 0; i < n; i++) {
    const diff = actual[i] - predicted[i];
    sumAE += Math.abs(diff);
    sumSE += diff * diff;
    ssTot += (actual[i] - meanActual) ** 2;
    ssRes += diff ** 2;
  }

  return {
    mae: sumAE / n,
    rmse: Math.sqrt(sumSE / n),
    r2: 1 - ssRes / ssTot
  };
}

function findOptimalWeights(data: any[], mainScore: string, detailScores: string[]): number[] {
  // グリッドサーチで最適な重みを探索（単純なアプローチ）
  const steps = 20;
  let bestWeights = detailScores.map(() => 1 / detailScores.length);
  let bestError = Infinity;

  const actual = data.map(d => d[mainScore]);

  // 重みの組み合わせを試す（簡易版）
  const numDetails = detailScores.length;

  // 均等重みから開始
  for (let iter = 0; iter < 1000; iter++) {
    // ランダムに重みを微調整
    const weights = [...bestWeights];
    const idx = Math.floor(Math.random() * numDetails);
    const delta = (Math.random() - 0.5) * 0.1;
    weights[idx] += delta;

    // 正規化
    const sum = weights.reduce((a, b) => a + Math.max(0, b), 0);
    for (let i = 0; i < numDetails; i++) {
      weights[i] = Math.max(0, weights[i]) / sum;
    }

    // エラー計算
    const predicted = data.map(d => {
      let s = 0;
      for (let i = 0; i < numDetails; i++) {
        s += weights[i] * (d[detailScores[i]] || 0);
      }
      return s;
    });

    const error = calculateErrors(actual, predicted);
    if (error.mae < bestError) {
      bestError = error.mae;
      bestWeights = weights;
    }
  }

  return bestWeights;
}

function analyzeIndependentScores(data: any[]) {
  // 役割理解、主導、育成には対応する詳細スコアがない
  // これらがどのように計算されているか推測

  console.log('\n【役割理解 (score_role) の分析】');
  console.log('  - 詳細スコアは存在しない');
  console.log('  - 0.1刻み、上限5.0');

  const roleData = data.filter(d => d.score_role != null);
  const roleValues = roleData.map(d => d.score_role);
  console.log(`  データ数: ${roleData.length}`);
  console.log(`  平均: ${(roleValues.reduce((a, b) => a + b, 0) / roleValues.length).toFixed(2)}`);
  console.log(`  標準偏差: ${calculateStdDev(roleValues).toFixed(2)}`);
  console.log(`  最小: ${Math.min(...roleValues)}, 最大: ${Math.max(...roleValues)}`);

  // score_roleとscore_problem, score_solutionの関係
  const valid = roleData.filter(d => d.score_problem != null && d.score_solution != null);
  if (valid.length > 0) {
    // 問題把握と対策立案の平均との関係
    let sumDiff = 0;
    for (const d of valid) {
      const avgPS = (d.score_problem + d.score_solution) / 2;
      sumDiff += Math.abs(d.score_role - avgPS);
    }
    console.log(`  score_roleと(score_problem + score_solution)/2の平均差: ${(sumDiff / valid.length).toFixed(3)}`);
  }

  console.log('\n【主導 (score_leadership) の分析】');
  console.log('  - 詳細スコアは存在しない');
  console.log('  - 0.5刻み、上限4.0');

  const leaderData = data.filter(d => d.score_leadership != null);
  const leaderValues = leaderData.map(d => d.score_leadership);
  console.log(`  データ数: ${leaderData.length}`);
  console.log(`  平均: ${(leaderValues.reduce((a, b) => a + b, 0) / leaderValues.length).toFixed(2)}`);
  console.log(`  標準偏差: ${calculateStdDev(leaderValues).toFixed(2)}`);
  console.log(`  最小: ${Math.min(...leaderValues)}, 最大: ${Math.max(...leaderValues)}`);

  console.log('\n【育成 (score_development) の分析】');
  console.log('  - 詳細スコアは存在しない');
  console.log('  - 0.5刻み、上限4.0');

  const devData = data.filter(d => d.score_development != null);
  const devValues = devData.map(d => d.score_development);
  console.log(`  データ数: ${devData.length}`);
  console.log(`  平均: ${(devValues.reduce((a, b) => a + b, 0) / devValues.length).toFixed(2)}`);
  console.log(`  標準偏差: ${calculateStdDev(devValues).toFixed(2)}`);
  console.log(`  最小: ${Math.min(...devValues)}, 最大: ${Math.max(...devValues)}`);
}

function calculateStdDev(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sqDiff = values.reduce((acc, v) => acc + (v - mean) ** 2, 0);
  return Math.sqrt(sqDiff / n);
}

function analyzePatterns(data: any[], mainScore: string, detailScores: string[]) {
  console.log(`\n【${mainScore} のパターン分析】`);

  // スコア帯ごとの詳細スコア分布
  const buckets = new Map<number, any[]>();
  for (const d of data) {
    const bucket = d[mainScore];
    if (!buckets.has(bucket)) {
      buckets.set(bucket, []);
    }
    buckets.get(bucket)!.push(d);
  }

  console.log('\nスコア帯別の詳細スコア平均:');
  const sortedBuckets = Array.from(buckets.keys()).sort((a, b) => a - b);

  console.log(`${'主要'.padEnd(8)}| ${detailScores.map(ds => ds.replace('detail_', '').replace('problem_', 'p_').replace('solution_', 's_').replace('collab_', 'c_').slice(0, 8).padEnd(8)).join(' | ')} | 詳細平均 | 件数`);
  console.log('-'.repeat(100));

  for (const bucket of sortedBuckets) {
    const items = buckets.get(bucket)!;
    const avgs = detailScores.map(ds => {
      const sum = items.reduce((acc, d) => acc + (d[ds] || 0), 0);
      return (sum / items.length).toFixed(2).padStart(8);
    });

    const totalAvg = items.reduce((acc, d) => {
      const sum = detailScores.reduce((s, ds) => s + (d[ds] || 0), 0);
      return acc + sum / detailScores.length;
    }, 0) / items.length;

    console.log(`${bucket.toFixed(1).padEnd(8)}| ${avgs.join(' | ')} | ${totalAvg.toFixed(2).padStart(8)} | ${items.length}`);
  }
}

analyzeScores().catch(console.error);
