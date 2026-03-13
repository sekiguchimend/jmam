/**
 * 重複データを削除し、ユニーク制約を追加するスクリプト
 *
 * 実行方法:
 * npx tsx scripts/fix-duplicates-and-add-constraint.ts
 *
 * 注意: 本番環境で実行する前に必ずバックアップを取ってください！
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

async function fixDuplicatesAndAddConstraint() {
  console.log('=== 重複データ修正スクリプト ===\n');
  console.log('⚠️  このスクリプトは以下の操作を行います:');
  console.log('   1. 重複データを削除（各 case_id + response_id で最新の1件のみ残す）');
  console.log('   2. ユニーク制約を追加\n');

  // 1. 現在の状態を確認
  console.log('1. 現在の状態を確認...');
  const { count: beforeCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });
  console.log(`   修正前のレコード数: ${beforeCount} 件\n`);

  // 2. 重複を削除するSQL（各 case_id + response_id で最新の1件のみ残す）
  console.log('2. 重複データを削除中...');

  const deleteDuplicatesSQL = `
    DELETE FROM responses
    WHERE id NOT IN (
      SELECT DISTINCT ON (case_id, response_id) id
      FROM responses
      ORDER BY case_id, response_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
    );
  `;

  // Service Role で直接SQLを実行（RPC経由）
  // Supabase の場合、直接SQLを実行するには pgAdmin や別の方法が必要
  // ここでは代替手段として、プログラムで重複を削除

  // 全データを取得して重複を特定
  const { data: allResponses, error: fetchError } = await supabase
    .from('responses')
    .select('id, case_id, response_id, updated_at, created_at')
    .order('updated_at', { ascending: false });

  if (fetchError) {
    console.error('   データ取得エラー:', fetchError.message);
    return;
  }

  // 各 (case_id, response_id) で最初の1件（最新）を残し、残りを削除対象に
  const keepIds = new Set<string>();
  const seen = new Set<string>();
  const deleteIds: string[] = [];

  for (const r of allResponses || []) {
    const key = `${r.case_id}|${r.response_id}`;
    if (!seen.has(key)) {
      seen.add(key);
      keepIds.add(r.id);
    } else {
      deleteIds.push(r.id);
    }
  }

  console.log(`   保持するレコード数: ${keepIds.size} 件`);
  console.log(`   削除するレコード数: ${deleteIds.length} 件`);

  if (deleteIds.length === 0) {
    console.log('   重複データはありません。\n');
  } else {
    // バッチで削除（Supabaseの制限を考慮）
    const batchSize = 500;
    let deletedTotal = 0;

    for (let i = 0; i < deleteIds.length; i += batchSize) {
      const batch = deleteIds.slice(i, i + batchSize);
      const { error: deleteError } = await supabase
        .from('responses')
        .delete()
        .in('id', batch);

      if (deleteError) {
        console.error(`   バッチ削除エラー (${i}~${i + batch.length}):`, deleteError.message);
        return;
      }
      deletedTotal += batch.length;
      console.log(`   削除進捗: ${deletedTotal}/${deleteIds.length} 件`);
    }

    console.log(`   ✓ ${deletedTotal} 件の重複データを削除しました\n`);
  }

  // 3. 削除後の確認
  console.log('3. 削除後の状態を確認...');
  const { count: afterCount } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });
  console.log(`   修正後のレコード数: ${afterCount} 件`);
  console.log(`   削減されたレコード数: ${(beforeCount || 0) - (afterCount || 0)} 件\n`);

  // 4. ユニーク制約の追加（SQLで直接実行が必要）
  console.log('4. ユニーク制約を追加...');
  console.log('   ⚠️  以下のSQLをSupabase SQL Editorで実行してください:\n');
  console.log('   ---------------------------------------------------');
  console.log('   ALTER TABLE responses');
  console.log('   ADD CONSTRAINT responses_case_response_unique');
  console.log('   UNIQUE (case_id, response_id);');
  console.log('   ---------------------------------------------------\n');

  // 5. 最終確認
  console.log('5. 重複がないことを確認...');
  const { data: checkData } = await supabase
    .from('responses')
    .select('case_id, response_id')
    .limit(5000);

  if (checkData) {
    const checkSeen = new Map<string, number>();
    for (const r of checkData) {
      const key = `${r.case_id}|${r.response_id}`;
      checkSeen.set(key, (checkSeen.get(key) || 0) + 1);
    }
    const dups = Array.from(checkSeen.values()).filter(c => c > 1).length;
    if (dups === 0) {
      console.log('   ✓ 重複データはありません\n');
    } else {
      console.log(`   ⚠️  まだ ${dups} 件の重複があります\n`);
    }
  }

  console.log('=== 完了 ===');
  console.log('\n次のステップ:');
  console.log('1. Supabase SQL Editor で上記のユニーク制約を追加');
  console.log('2. アプリケーションをテスト');
}

fixDuplicatesAndAddConstraint().catch(console.error);
