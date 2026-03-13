/**
 * 重複データを削除し、ユニーク制約を追加するマイグレーション
 * ページネーション対応版
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

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  db: { schema: 'public' },
});

async function applyMigration() {
  console.log('=== マイグレーション実行 ===\n');

  // 1. 修正前のレコード数
  const { count: beforeCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });
  console.log(`修正前のレコード数: ${beforeCount} 件\n`);

  // 2. 全データを取得（ページネーション対応）
  console.log('全データを取得中...');
  const allData: { id: string; case_id: string; response_id: string; updated_at: string | null }[] = [];
  const pageSize = 1000;
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from('responses')
      .select('id, case_id, response_id, updated_at')
      .order('updated_at', { ascending: false, nullsFirst: false })
      .range(offset, offset + pageSize - 1);

    if (error) {
      console.error('データ取得エラー:', error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) break;

    allData.push(...data);
    console.log(`  取得済み: ${allData.length} 件`);
    offset += pageSize;

    if (data.length < pageSize) break;
  }

  console.log(`総取得数: ${allData.length} 件\n`);

  // 3. 重複を特定
  console.log('重複データを特定中...');
  const keepIds = new Set<string>();
  const seen = new Set<string>();
  const deleteIds: string[] = [];

  for (const r of allData) {
    const key = `${r.case_id}|${r.response_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      keepIds.add(r.id);
    } else {
      deleteIds.push(r.id);
    }
  }

  console.log(`ユニークな組み合わせ: ${keepIds.size} 件`);
  console.log(`削除対象: ${deleteIds.length} 件\n`);

  // 4. バッチ削除
  if (deleteIds.length > 0) {
    console.log('重複データを削除中...');
    const batchSize = 200; // 小さめのバッチサイズでエラーを回避
    let deleted = 0;

    for (let i = 0; i < deleteIds.length; i += batchSize) {
      const batch = deleteIds.slice(i, i + batchSize);

      let retries = 3;
      while (retries > 0) {
        const { error } = await supabase.from('responses').delete().in('id', batch);
        if (!error) {
          deleted += batch.length;
          break;
        }
        retries--;
        if (retries === 0) {
          console.error(`削除エラー (バッチ ${i}): ${error.message}`);
        } else {
          console.log(`  リトライ中...`);
          await new Promise((r) => setTimeout(r, 1000));
        }
      }

      if (deleted % 1000 === 0 || i + batchSize >= deleteIds.length) {
        console.log(`  削除進捗: ${deleted}/${deleteIds.length}`);
      }
    }
    console.log('✓ 重複データ削除完了\n');
  } else {
    console.log('✓ 重複データなし\n');
  }

  // 5. 修正後のレコード数
  const { count: afterCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });
  console.log(`修正後のレコード数: ${afterCount} 件`);
  console.log(`削除されたレコード数: ${(beforeCount || 0) - (afterCount || 0)} 件\n`);

  // 6. ユニーク制約の追加
  console.log('====================================');
  console.log('次のステップ: Supabase SQL Editor で以下を実行:');
  console.log('====================================\n');
  console.log(`ALTER TABLE responses
ADD CONSTRAINT responses_case_response_unique
UNIQUE (case_id, response_id);`);
  console.log('\n====================================');
}

applyMigration().catch(console.error);
