/**
 * insertResponses の upsert 動作を検証するテストスクリプト
 *
 * 実行方法:
 * npx tsx scripts/test-upsert.ts
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// .env.local を読み込み
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function testUpsert() {
  const testCaseId = 'TEST_UPSERT_001';
  const testResponseId = 'TEST_RESPONSE_001';

  console.log('=== upsert テスト開始 ===\n');

  // 1. テスト用ケースを作成
  console.log('1. テスト用ケースを作成...');
  const { error: caseError } = await supabase
    .from('cases')
    .upsert({ case_id: testCaseId, case_name: 'テストケース' }, { onConflict: 'case_id' });

  if (caseError) {
    console.error('ケース作成エラー:', caseError.message);
    return;
  }
  console.log('   ✓ ケース作成成功\n');

  // 2. 最初のデータを挿入
  console.log('2. 最初のデータを挿入 (score_problem: 2.5)...');
  const firstData = {
    case_id: testCaseId,
    response_id: testResponseId,
    score_problem: 2.5,
    score_solution: 2.0,
    answer_q1: '最初の回答',
  };

  const { error: insertError1 } = await supabase
    .from('responses')
    .upsert(firstData, { onConflict: 'case_id,response_id' });

  if (insertError1) {
    console.error('最初の挿入エラー:', insertError1.message);
    return;
  }
  console.log('   ✓ 最初の挿入成功\n');

  // 3. 同じキーで再度 upsert（更新されるはず）
  console.log('3. 同じキーで upsert (score_problem: 3.5 に更新)...');
  const secondData = {
    case_id: testCaseId,
    response_id: testResponseId,
    score_problem: 3.5,
    score_solution: 3.0,
    answer_q1: '更新された回答',
  };

  const { error: insertError2 } = await supabase
    .from('responses')
    .upsert(secondData, { onConflict: 'case_id,response_id' });

  if (insertError2) {
    console.error('2回目の upsert エラー:', insertError2.message);
    return;
  }
  console.log('   ✓ 2回目の upsert 成功\n');

  // 4. データを確認
  console.log('4. データを確認...');
  const { data: result, error: selectError } = await supabase
    .from('responses')
    .select('case_id, response_id, score_problem, score_solution, answer_q1')
    .eq('case_id', testCaseId)
    .eq('response_id', testResponseId);

  if (selectError) {
    console.error('データ取得エラー:', selectError.message);
    return;
  }

  console.log('   取得したデータ:', JSON.stringify(result, null, 2));

  if (result && result.length === 1) {
    const row = result[0];
    if (row.score_problem === 3.5 && row.answer_q1 === '更新された回答') {
      console.log('\n   ✓ テスト成功: データが正しく更新されました');
      console.log('     - レコード数: 1（重複なし）');
      console.log('     - score_problem: 2.5 → 3.5');
      console.log('     - answer_q1: "最初の回答" → "更新された回答"');
    } else {
      console.error('\n   ✗ テスト失敗: データが期待通りに更新されていません');
    }
  } else {
    console.error('\n   ✗ テスト失敗: レコード数が1ではありません:', result?.length);
  }

  // 5. クリーンアップ
  console.log('\n5. テストデータをクリーンアップ...');
  await supabase.from('responses').delete().eq('case_id', testCaseId);
  await supabase.from('cases').delete().eq('case_id', testCaseId);
  console.log('   ✓ クリーンアップ完了\n');

  console.log('=== upsert テスト完了 ===');
}

testUpsert().catch(console.error);
