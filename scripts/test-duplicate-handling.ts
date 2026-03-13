/**
 * 重複処理のテストスクリプト
 * 同じcase_id + response_idを2回挿入して、重複せず更新されることを確認
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

// insertResponses関数のロジックを再現
async function insertResponsesTest(responses: any[]): Promise<{ inserted: number; updated: number }> {
  // 既存レコードのキーを取得
  const keys = responses.map((r) => ({ case_id: r.case_id, response_id: r.response_id }));
  const uniqueKeys = Array.from(
    new Map(keys.map((k) => [`${k.case_id}|${k.response_id}`, k])).values()
  );

  // 既存レコードを検索
  const existingMap = new Map<string, string>();
  const batchSize = 100;
  for (let i = 0; i < uniqueKeys.length; i += batchSize) {
    const batch = uniqueKeys.slice(i, i + batchSize);
    const orConditions = batch.map((k) => `and(case_id.eq.${k.case_id},response_id.eq.${k.response_id})`).join(',');
    const { data } = await supabase
      .from('responses')
      .select('id, case_id, response_id')
      .or(orConditions);
    for (const row of data ?? []) {
      existingMap.set(`${row.case_id}|${row.response_id}`, row.id);
    }
  }

  // 挿入と更新に分類
  const toInsert: any[] = [];
  const toUpdate: { id: string; data: any }[] = [];

  for (const r of responses) {
    const key = `${r.case_id}|${r.response_id}`;
    const existingId = existingMap.get(key);
    if (existingId) {
      toUpdate.push({ id: existingId, data: r });
    } else {
      toInsert.push(r);
      existingMap.set(key, 'pending');
    }
  }

  // 新規挿入
  if (toInsert.length > 0) {
    const { error } = await supabase.from('responses').insert(toInsert);
    if (error) throw new Error(`挿入エラー: ${error.message}`);
  }

  // 既存更新
  for (const { id, data } of toUpdate) {
    const { error } = await supabase.from('responses').update(data).eq('id', id);
    if (error) console.error('更新エラー:', error.message);
  }

  return { inserted: toInsert.length, updated: toUpdate.length };
}

async function runTest() {
  const TEST_CASE_ID = 'TEST_DUP_CHECK';
  const TEST_RESPONSE_ID = 'TEST_RESP_001';

  console.log('=== 重複処理テスト ===\n');

  // テスト用ケースを作成
  await supabase.from('cases').upsert({ case_id: TEST_CASE_ID, case_name: 'テスト用ケース' }, { onConflict: 'case_id' });

  // クリーンアップ（既存のテストデータを削除）
  await supabase.from('responses').delete().eq('case_id', TEST_CASE_ID);

  // 1回目：新規挿入
  console.log('【1回目】新規データを挿入...');
  const data1 = [{
    case_id: TEST_CASE_ID,
    response_id: TEST_RESPONSE_ID,
    score_problem: 1.0,
    score_solution: 1.0,
  }];
  const result1 = await insertResponsesTest(data1);
  console.log(`  結果: 挿入=${result1.inserted}, 更新=${result1.updated}`);

  // 件数確認
  const { count: count1 } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', TEST_CASE_ID);
  console.log(`  DBの件数: ${count1} 件\n`);

  // 2回目：同じデータを再度挿入（更新されるべき）
  console.log('【2回目】同じcase_id + response_idで別のスコアを挿入...');
  const data2 = [{
    case_id: TEST_CASE_ID,
    response_id: TEST_RESPONSE_ID,
    score_problem: 5.0,  // スコアを変更
    score_solution: 5.0,
  }];
  const result2 = await insertResponsesTest(data2);
  console.log(`  結果: 挿入=${result2.inserted}, 更新=${result2.updated}`);

  // 件数確認
  const { count: count2 } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true })
    .eq('case_id', TEST_CASE_ID);
  console.log(`  DBの件数: ${count2} 件\n`);

  // データ内容確認
  const { data: finalData } = await supabase
    .from('responses')
    .select('score_problem, score_solution')
    .eq('case_id', TEST_CASE_ID)
    .eq('response_id', TEST_RESPONSE_ID);

  console.log('【最終結果】');
  if (count2 === 1 && finalData?.[0]?.score_problem === 5.0) {
    console.log('✅ 成功: 重複せず、既存レコードが更新されました');
    console.log(`   score_problem: 1.0 → ${finalData[0].score_problem}`);
  } else {
    console.log('❌ 失敗: 重複が発生したか、更新されていません');
    console.log('   データ:', finalData);
  }

  // クリーンアップ
  await supabase.from('responses').delete().eq('case_id', TEST_CASE_ID);
  await supabase.from('cases').delete().eq('case_id', TEST_CASE_ID);

  console.log('\n=== テスト完了 ===');
}

runTest().catch(console.error);
