// 全データ件数を確認
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkAllData() {
  console.log('=== データベース全体の確認 ===\n');

  // 1. responsesテーブルの全件数（フィルタなし）
  const { count: totalCount, error: totalError } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });

  console.log(`【responsesテーブル】`);
  console.log(`  全件数: ${totalCount}`);
  if (totalError) console.log(`  エラー: ${totalError.message}`);

  // 2. 各スコア列がある件数
  const scoreColumns = [
    'score_problem',
    'score_solution',
    'score_role',
    'score_leadership',
    'score_collaboration',
    'score_development'
  ];

  console.log(`\n【各スコアのデータ件数】`);
  for (const col of scoreColumns) {
    const { count, error } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .not(col, 'is', null);

    console.log(`  ${col}: ${count}件`);
  }

  // 3. 全データを取得（limit 10000）
  const { data: allData, error: allError, count: fetchedCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact' })
    .limit(10000);

  console.log(`\n【全データ取得】`);
  console.log(`  取得件数: ${allData?.length}`);
  console.log(`  カウント: ${fetchedCount}`);

  // 4. case_idの分布
  if (allData) {
    const byCaseId = new Map<string, number>();
    for (const d of allData) {
      const caseId = d.case_id || 'NULL';
      byCaseId.set(caseId, (byCaseId.get(caseId) || 0) + 1);
    }

    console.log(`\n【case_idの分布】`);
    const sorted = Array.from(byCaseId.entries()).sort((a, b) => b[1] - a[1]);
    for (const [caseId, count] of sorted) {
      console.log(`  ${caseId}: ${count}件`);
    }
  }

  // 5. データの列（カラム）を確認
  if (allData && allData.length > 0) {
    const columns = Object.keys(allData[0]);
    console.log(`\n【カラム一覧】(${columns.length}個)`);
    console.log(columns.join(', '));
  }

  // 6. 他のテーブルを確認（一般的なテーブル名を試す）
  console.log(`\n【他のテーブル確認】`);

  const possibleTables = [
    'users',
    'cases',
    'scores',
    'evaluations',
    'assessments',
    'results',
    'answers',
    'submissions'
  ];

  for (const table of possibleTables) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });

    if (!error) {
      console.log(`  ${table}: ${count}件`);
    }
  }
}

checkAllData().catch(console.error);
