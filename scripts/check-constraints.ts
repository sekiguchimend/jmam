/**
 * responses テーブルの制約と重複データを確認
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkConstraints() {
  console.log('=== responses テーブルの状態を確認 ===\n');

  // 1. サンプルデータを取得
  console.log('1. サンプルデータ:');
  const { data: sampleData, error: sampleError } = await supabase
    .from('responses')
    .select('id, case_id, response_id')
    .limit(5);

  if (sampleError) {
    console.error('   エラー:', sampleError.message);
  } else {
    console.log('   ' + JSON.stringify(sampleData, null, 2).replace(/\n/g, '\n   '));
  }

  // 2. 総レコード数
  console.log('\n2. 総レコード数:');
  const { count, error: countError } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });

  if (countError) {
    console.error('   エラー:', countError.message);
  } else {
    console.log('   ' + count + ' 件');
  }

  // 3. 重複チェック（大量データがある場合はサンプリング）
  console.log('\n3. 重複データの確認:');
  const { data: allData, error: allError } = await supabase
    .from('responses')
    .select('case_id, response_id')
    .limit(5000);

  if (allError) {
    console.error('   エラー:', allError.message);
  } else if (allData) {
    const seen = new Map<string, number>();
    for (const r of allData) {
      const key = `${r.case_id}|${r.response_id}`;
      seen.set(key, (seen.get(key) || 0) + 1);
    }

    const duplicates = Array.from(seen.entries())
      .filter(([_, count]) => count > 1)
      .map(([key, count]) => ({ key, count }));

    console.log('   チェックしたレコード数: ' + allData.length);
    console.log('   ユニークな (case_id, response_id) 数: ' + seen.size);
    console.log('   重複している組み合わせ数: ' + duplicates.length);

    if (duplicates.length > 0) {
      console.log('\n   重複例（最大5件）:');
      duplicates.slice(0, 5).forEach((d) => {
        console.log(`     ${d.key}: ${d.count}件`);
      });
    }
  }

  // 4. ケースごとのレコード数
  console.log('\n4. ケースごとのレコード数:');
  const { data: caseData, error: caseError } = await supabase
    .from('cases')
    .select('case_id, case_name');

  if (caseError) {
    console.error('   エラー:', caseError.message);
  } else if (caseData) {
    for (const c of caseData.slice(0, 10)) {
      const { count: caseCount } = await supabase
        .from('responses')
        .select('*', { count: 'exact', head: true })
        .eq('case_id', c.case_id);
      console.log(`   ${c.case_id} (${c.case_name}): ${caseCount} 件`);
    }
  }

  console.log('\n=== 確認完了 ===');
}

checkConstraints().catch(console.error);
