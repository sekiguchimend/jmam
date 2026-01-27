// スコア関係性分析スクリプト
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseKey);

async function analyzeScores() {
  console.log('=== スコア関係性分析 ===\n');

  // responsesテーブルから全スコアデータを取得
  const { data, error } = await supabase
    .from('responses')
    .select(`
      id,
      case_id,
      response_id,
      score_problem,
      score_solution,
      score_role,
      score_leadership,
      score_collaboration,
      score_development,
      detail_problem_understanding,
      detail_problem_essence,
      detail_problem_maintenance_biz,
      detail_problem_maintenance_hr,
      detail_problem_reform_biz,
      detail_problem_reform_hr,
      detail_solution_coverage,
      detail_solution_planning,
      detail_solution_maintenance_biz,
      detail_solution_maintenance_hr,
      detail_solution_reform_biz,
      detail_solution_reform_hr,
      detail_collab_supervisor,
      detail_collab_external,
      detail_collab_member
    `)
    .not('score_problem', 'is', null)
    .limit(2000);

  if (error) {
    console.error('Error fetching data:', error);
    return;
  }

  console.log(`取得したレコード数: ${data?.length || 0}\n`);

  if (!data || data.length === 0) {
    console.log('データがありません');
    return;
  }

  // 1. 問題把握(score_problem)と詳細スコアの関係
  console.log('=== 1. 問題把握(score_problem)と詳細スコアの関係 ===');
  analyzeRelationship(data, 'score_problem', [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ]);

  // 2. 対策立案(score_solution)と詳細スコアの関係
  console.log('\n=== 2. 対策立案(score_solution)と詳細スコアの関係 ===');
  analyzeRelationship(data, 'score_solution', [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ]);

  // 3. 連携(score_collaboration)と詳細スコアの関係
  console.log('\n=== 3. 連携(score_collaboration)と詳細スコアの関係 ===');
  analyzeRelationship(data, 'score_collaboration', [
    'detail_collab_supervisor',
    'detail_collab_external',
    'detail_collab_member'
  ]);

  // 4. 役割理解(score_role)との関係
  console.log('\n=== 4. 役割理解(score_role)と他スコアの相関 ===');
  analyzeCorrelation(data, 'score_role');

  // 5. 主導(score_leadership)との関係
  console.log('\n=== 5. 主導(score_leadership)と他スコアの相関 ===');
  analyzeCorrelation(data, 'score_leadership');

  // 6. 育成(score_development)との関係
  console.log('\n=== 6. 育成(score_development)と他スコアの相関 ===');
  analyzeCorrelation(data, 'score_development');

  // 7. 計算式の推定
  console.log('\n=== 7. 主要スコアの計算式推定 ===');
  estimateFormulas(data);

  // 8. サンプルデータの表示
  console.log('\n=== 8. サンプルデータ（最初の10件） ===');
  showSampleData(data.slice(0, 10));
}

function analyzeRelationship(data: any[], mainScore: string, detailScores: string[]) {
  // 有効なデータのみフィルタ
  const validData = data.filter(d =>
    d[mainScore] != null &&
    detailScores.every(ds => d[ds] != null)
  );

  console.log(`有効データ数: ${validData.length}`);

  if (validData.length === 0) {
    console.log('有効なデータがありません');
    return;
  }

  // 各詳細スコアとの相関を計算
  for (const detailScore of detailScores) {
    const correlation = calculateCorrelation(
      validData.map(d => d[mainScore]),
      validData.map(d => d[detailScore])
    );
    console.log(`  ${detailScore}: 相関係数 = ${correlation.toFixed(4)}`);
  }

  // 詳細スコアの平均と主要スコアの関係
  const avgDetails = validData.map(d => {
    const sum = detailScores.reduce((acc, ds) => acc + (d[ds] || 0), 0);
    return sum / detailScores.length;
  });
  const mainScores = validData.map(d => d[mainScore]);

  const avgCorrelation = calculateCorrelation(mainScores, avgDetails);
  console.log(`  詳細スコア平均との相関: ${avgCorrelation.toFixed(4)}`);

  // 重回帰係数の推定（単純最小二乗法）
  console.log(`\n  推定計算式:`);
  const regression = multipleRegression(validData, mainScore, detailScores);
  console.log(`    ${mainScore} = ${regression.formula}`);
  console.log(`    R² = ${regression.r2.toFixed(4)}`);
}

function analyzeCorrelation(data: any[], targetScore: string) {
  const allScores = [
    'score_problem', 'score_solution', 'score_role',
    'score_leadership', 'score_collaboration', 'score_development'
  ];

  const validData = data.filter(d => d[targetScore] != null);

  for (const score of allScores) {
    if (score === targetScore) continue;
    const filteredData = validData.filter(d => d[score] != null);
    if (filteredData.length < 10) continue;

    const correlation = calculateCorrelation(
      filteredData.map(d => d[targetScore]),
      filteredData.map(d => d[score])
    );
    console.log(`  ${score}: 相関係数 = ${correlation.toFixed(4)}`);
  }
}

function calculateCorrelation(x: number[], y: number[]): number {
  const n = x.length;
  if (n === 0) return 0;

  const meanX = x.reduce((a, b) => a + b, 0) / n;
  const meanY = y.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denomX = 0;
  let denomY = 0;

  for (let i = 0; i < n; i++) {
    const dx = x[i] - meanX;
    const dy = y[i] - meanY;
    numerator += dx * dy;
    denomX += dx * dx;
    denomY += dy * dy;
  }

  const denominator = Math.sqrt(denomX * denomY);
  return denominator === 0 ? 0 : numerator / denominator;
}

function multipleRegression(data: any[], target: string, features: string[]): { formula: string; r2: number; coefficients: number[] } {
  const validData = data.filter(d =>
    d[target] != null &&
    features.every(f => d[f] != null)
  );

  if (validData.length < features.length + 1) {
    return { formula: 'データ不足', r2: 0, coefficients: [] };
  }

  const n = validData.length;
  const m = features.length;

  // Y = 目的変数
  const Y = validData.map(d => d[target]);

  // X = 説明変数行列（切片項含む）
  const X = validData.map(d => [1, ...features.map(f => d[f])]);

  // 正規方程式: (X'X)β = X'Y
  // X'X の計算
  const XtX: number[][] = [];
  for (let i = 0; i <= m; i++) {
    XtX[i] = [];
    for (let j = 0; j <= m; j++) {
      let sum = 0;
      for (let k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      XtX[i][j] = sum;
    }
  }

  // X'Y の計算
  const XtY: number[] = [];
  for (let i = 0; i <= m; i++) {
    let sum = 0;
    for (let k = 0; k < n; k++) {
      sum += X[k][i] * Y[k];
    }
    XtY[i] = sum;
  }

  // ガウス消去法で係数を求める
  const beta = solveLinearSystem(XtX, XtY);

  // 予測値の計算
  const predicted = validData.map((d) => {
    let pred = beta[0];
    for (let j = 0; j < m; j++) {
      pred += beta[j + 1] * d[features[j]];
    }
    return pred;
  });

  // R²の計算
  const meanY = Y.reduce((a, b) => a + b, 0) / n;
  const ssTotal = Y.reduce((acc, y) => acc + (y - meanY) ** 2, 0);
  const ssResidual = Y.reduce((acc, y, i) => acc + (y - predicted[i]) ** 2, 0);
  const r2 = 1 - ssResidual / ssTotal;

  // 計算式の生成
  let formula = `${beta[0].toFixed(3)}`;
  for (let i = 0; i < features.length; i++) {
    const coef = beta[i + 1];
    const sign = coef >= 0 ? '+' : '-';
    const shortName = features[i].replace('detail_', '').replace('problem_', 'p_').replace('solution_', 's_').replace('collab_', 'c_');
    formula += ` ${sign} ${Math.abs(coef).toFixed(3)}*${shortName}`;
  }

  return { formula, r2, coefficients: beta };
}

function solveLinearSystem(A: number[][], b: number[]): number[] {
  const n = A.length;
  const augmented = A.map((row, i) => [...row, b[i]]);

  // 前進消去
  for (let i = 0; i < n; i++) {
    // ピボット選択
    let maxRow = i;
    for (let k = i + 1; k < n; k++) {
      if (Math.abs(augmented[k][i]) > Math.abs(augmented[maxRow][i])) {
        maxRow = k;
      }
    }
    [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];

    // 消去
    for (let k = i + 1; k < n; k++) {
      const factor = augmented[k][i] / augmented[i][i];
      for (let j = i; j <= n; j++) {
        augmented[k][j] -= factor * augmented[i][j];
      }
    }
  }

  // 後退代入
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    x[i] = augmented[i][n];
    for (let j = i + 1; j < n; j++) {
      x[i] -= augmented[i][j] * x[j];
    }
    x[i] /= augmented[i][i];
  }

  return x;
}

function estimateFormulas(data: any[]) {
  // 問題把握の計算式推定
  console.log('\n【問題把握 (score_problem) の計算式】');
  const problemDetails = [
    'detail_problem_understanding',
    'detail_problem_essence',
    'detail_problem_maintenance_biz',
    'detail_problem_maintenance_hr',
    'detail_problem_reform_biz',
    'detail_problem_reform_hr'
  ];
  const problemResult = multipleRegression(data, 'score_problem', problemDetails);
  console.log(`  ${problemResult.formula}`);
  console.log(`  決定係数 R² = ${problemResult.r2.toFixed(4)}`);

  // 対策立案の計算式推定
  console.log('\n【対策立案 (score_solution) の計算式】');
  const solutionDetails = [
    'detail_solution_coverage',
    'detail_solution_planning',
    'detail_solution_maintenance_biz',
    'detail_solution_maintenance_hr',
    'detail_solution_reform_biz',
    'detail_solution_reform_hr'
  ];
  const solutionResult = multipleRegression(data, 'score_solution', solutionDetails);
  console.log(`  ${solutionResult.formula}`);
  console.log(`  決定係数 R² = ${solutionResult.r2.toFixed(4)}`);

  // 連携の計算式推定
  console.log('\n【連携 (score_collaboration) の計算式】');
  const collabDetails = [
    'detail_collab_supervisor',
    'detail_collab_external',
    'detail_collab_member'
  ];
  const collabResult = multipleRegression(data, 'score_collaboration', collabDetails);
  console.log(`  ${collabResult.formula}`);
  console.log(`  決定係数 R² = ${collabResult.r2.toFixed(4)}`);

  // 簡易計算式（平均ベース）の検証
  console.log('\n【簡易計算式（平均ベース）の検証】');

  // 問題把握
  const problemValid = data.filter(d =>
    d.score_problem != null &&
    problemDetails.every(pd => d[pd] != null)
  );
  if (problemValid.length > 0) {
    const errors = problemValid.map(d => {
      const avg = problemDetails.reduce((acc, pd) => acc + d[pd], 0) / problemDetails.length;
      // 平均を5点スケールに変換（詳細は4点スケール）
      const predicted = (avg / 4) * 5;
      return Math.abs(d.score_problem - predicted);
    });
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    console.log(`  問題把握: MAE = ${mae.toFixed(4)} (平均→5点スケール変換)`);
  }

  // 対策立案
  const solutionValid = data.filter(d =>
    d.score_solution != null &&
    solutionDetails.every(sd => d[sd] != null)
  );
  if (solutionValid.length > 0) {
    const errors = solutionValid.map(d => {
      const avg = solutionDetails.reduce((acc, sd) => acc + d[sd], 0) / solutionDetails.length;
      const predicted = (avg / 4) * 5;
      return Math.abs(d.score_solution - predicted);
    });
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    console.log(`  対策立案: MAE = ${mae.toFixed(4)} (平均→5点スケール変換)`);
  }

  // 連携
  const collabValid = data.filter(d =>
    d.score_collaboration != null &&
    collabDetails.every(cd => d[cd] != null)
  );
  if (collabValid.length > 0) {
    const errors = collabValid.map(d => {
      const avg = collabDetails.reduce((acc, cd) => acc + d[cd], 0) / collabDetails.length;
      // 連携は4点スケール
      return Math.abs(d.score_collaboration - avg);
    });
    const mae = errors.reduce((a, b) => a + b, 0) / errors.length;
    console.log(`  連携: MAE = ${mae.toFixed(4)} (単純平均)`);
  }
}

function showSampleData(samples: any[]) {
  for (const d of samples) {
    console.log(`\nResponse ID: ${d.response_id}`);
    console.log(`  主要スコア:`);
    console.log(`    問題把握: ${d.score_problem}, 対策立案: ${d.score_solution}`);
    console.log(`    役割理解: ${d.score_role}, 主導: ${d.score_leadership}`);
    console.log(`    連携: ${d.score_collaboration}, 育成: ${d.score_development}`);
    console.log(`  問題把握詳細:`);
    console.log(`    状況理解: ${d.detail_problem_understanding}, 本質把握: ${d.detail_problem_essence}`);
    console.log(`    維持管理(業務): ${d.detail_problem_maintenance_biz}, 維持管理(人): ${d.detail_problem_maintenance_hr}`);
    console.log(`    改革(業務): ${d.detail_problem_reform_biz}, 改革(人): ${d.detail_problem_reform_hr}`);
    console.log(`  対策立案詳細:`);
    console.log(`    網羅性: ${d.detail_solution_coverage}, 計画性: ${d.detail_solution_planning}`);
    console.log(`    維持管理(業務): ${d.detail_solution_maintenance_biz}, 維持管理(人): ${d.detail_solution_maintenance_hr}`);
    console.log(`    改革(業務): ${d.detail_solution_reform_biz}, 改革(人): ${d.detail_solution_reform_hr}`);
    console.log(`  連携詳細:`);
    console.log(`    上司: ${d.detail_collab_supervisor}, 職場外: ${d.detail_collab_external}, メンバー: ${d.detail_collab_member}`);
  }
}

// 実行
analyzeScores().catch(console.error);
