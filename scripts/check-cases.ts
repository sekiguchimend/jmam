// casesテーブルの内容を確認
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkCases() {
  console.log('=== casesテーブルの確認 ===\n');

  const { data, error, count } = await supabase
    .from('cases')
    .select('*', { count: 'exact' });

  if (error) {
    console.log('エラー:', error.message);
    return;
  }

  console.log(`件数: ${count}\n`);

  if (data) {
    for (const c of data) {
      console.log(`ID: ${c.id}`);
      console.log(`  case_id: ${c.case_id}`);
      console.log(`  title: ${c.title}`);
      console.log(`  created_at: ${c.created_at}`);
      console.log('');
    }
  }
}

checkCases().catch(console.error);
