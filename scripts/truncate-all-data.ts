// 全データ削除スクリプト
// 使用方法: npx tsx scripts/truncate-all-data.ts

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('環境変数が設定されていません: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function truncateAllData() {
  console.log('========================================');
  console.log('全データ削除を開始します...');
  console.log('========================================');

  // 削除前のカウント
  const tables = ['typical_examples', 'response_embeddings', 'embedding_queue', 'responses', 'questions', 'cases'];

  console.log('\n【削除前のレコード数】');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`  ${table}: エラー - ${error.message}`);
    } else {
      console.log(`  ${table}: ${count} 件`);
    }
  }

  // 外部キー制約を考慮した順序で削除
  console.log('\n【削除処理】');

  // typical_examples
  const { error: e1 } = await supabase.from('typical_examples').delete().neq('case_id', '___NEVER_MATCH___');
  console.log(`  typical_examples: ${e1 ? `エラー - ${e1.message}` : '削除完了'}`);

  // response_embeddings
  const { error: e2 } = await supabase.from('response_embeddings').delete().neq('case_id', '___NEVER_MATCH___');
  console.log(`  response_embeddings: ${e2 ? `エラー - ${e2.message}` : '削除完了'}`);

  // embedding_queue
  const { error: e3 } = await supabase.from('embedding_queue').delete().neq('case_id', '___NEVER_MATCH___');
  console.log(`  embedding_queue: ${e3 ? `エラー - ${e3.message}` : '削除完了'}`);

  // responses
  const { error: e4 } = await supabase.from('responses').delete().neq('case_id', '___NEVER_MATCH___');
  console.log(`  responses: ${e4 ? `エラー - ${e4.message}` : '削除完了'}`);

  // questions
  const { error: e5 } = await supabase.from('questions').delete().neq('case_id', '___NEVER_MATCH___');
  console.log(`  questions: ${e5 ? `エラー - ${e5.message}` : '削除完了'}`);

  // cases
  const { error: e6 } = await supabase.from('cases').delete().neq('case_id', '___NEVER_MATCH___');
  console.log(`  cases: ${e6 ? `エラー - ${e6.message}` : '削除完了'}`);

  // 削除後のカウント
  console.log('\n【削除後のレコード数】');
  for (const table of tables) {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) {
      console.error(`  ${table}: エラー - ${error.message}`);
    } else {
      console.log(`  ${table}: ${count} 件`);
    }
  }

  console.log('\n========================================');
  console.log('全データ削除が完了しました');
  console.log('========================================');
}

truncateAllData().catch(console.error);
