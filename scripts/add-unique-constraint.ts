/**
 * ユニーク制約を追加するスクリプト
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

async function addUniqueConstraint() {
  console.log('=== ユニーク制約を追加 ===\n');

  // rpc経由でSQLを実行（exec_sql関数が必要）
  // Supabaseではデフォルトでこの関数がないため、
  // 代わりにupsertテストで制約の有無を確認

  console.log('upsertテストで制約を確認...\n');

  const testCaseId = 'TEST_CONSTRAINT_CHECK';
  const testResponseId = 'TEST_001';

  // テスト用ケースを作成
  await supabase.from('cases').upsert({ case_id: testCaseId, case_name: 'テスト' }, { onConflict: 'case_id' });

  // 1回目の挿入
  const { error: err1 } = await supabase
    .from('responses')
    .upsert(
      { case_id: testCaseId, response_id: testResponseId, score_problem: 1.0 },
      { onConflict: 'case_id,response_id' }
    );

  if (err1) {
    if (err1.message.includes('no unique or exclusion constraint')) {
      console.log('❌ ユニーク制約がまだ追加されていません\n');
      console.log('以下のSQLをSupabase SQL Editorで実行してください:\n');
      console.log('----------------------------------------');
      console.log(`ALTER TABLE responses
ADD CONSTRAINT responses_case_response_unique
UNIQUE (case_id, response_id);`);
      console.log('----------------------------------------\n');
      console.log('Supabase Dashboard: https://supabase.com/dashboard/project/gibtfzedhtpotgkavuwl/sql');
    } else {
      console.error('エラー:', err1.message);
    }
  } else {
    // 2回目のupsert（更新されるはず）
    const { error: err2 } = await supabase
      .from('responses')
      .upsert(
        { case_id: testCaseId, response_id: testResponseId, score_problem: 2.0 },
        { onConflict: 'case_id,response_id' }
      );

    if (err2) {
      console.error('2回目のupsertエラー:', err2.message);
    } else {
      // 確認
      const { data } = await supabase
        .from('responses')
        .select('score_problem')
        .eq('case_id', testCaseId)
        .eq('response_id', testResponseId);

      if (data && data.length === 1 && data[0].score_problem === 2.0) {
        console.log('✅ ユニーク制約が正しく機能しています！');
        console.log('   - 1回目: score_problem = 1.0 (挿入)');
        console.log('   - 2回目: score_problem = 2.0 (更新)');
        console.log('   - 結果: 1レコードのみ、score_problem = 2.0');
      } else {
        console.log('⚠️  予期しない結果:', data);
      }
    }

    // クリーンアップ
    await supabase.from('responses').delete().eq('case_id', testCaseId);
    await supabase.from('cases').delete().eq('case_id', testCaseId);
  }

  console.log('\n=== 完了 ===');
}

addUniqueConstraint().catch(console.error);
