#!/usr/bin/env npx tsx
/**
 * データベースクリーンアップスクリプト
 *
 * 使い方:
 *   npx tsx scripts/db-cleanup.ts [コマンド]
 *
 * コマンド:
 *   jobs      - upload_jobsのクリーンアップのみ
 *   queue     - embedding_queueのクリーンアップ
 *   all       - 全データ削除（確認あり）
 *   status    - 現在の状態を表示
 *
 * 環境変数 (.env.local から自動読み込み):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// .env.local を読み込み
config({ path: resolve(process.cwd(), '.env.local') });

import { createClient } from '@supabase/supabase-js';
import * as readline from 'readline';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 環境変数が設定されていません');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ========================================
// ユーティリティ
// ========================================

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(`${message} (yes/no): `, (answer) => {
      rl.close();
      resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
    });
  });
}

async function getTableCount(table: string): Promise<number> {
  const { count } = await supabase.from(table).select('*', { count: 'exact', head: true });
  return count ?? 0;
}

// ========================================
// ステータス表示
// ========================================

async function showStatus() {
  console.log('\n📊 データベース状態\n');

  const tables = [
    'upload_jobs',
    'cases',
    'case_assignments',
    'responses',
    'response_embeddings',
    'embedding_queue',
    'typical_examples',
    'admin_users',
  ];

  for (const table of tables) {
    try {
      const count = await getTableCount(table);
      console.log(`  ${table}: ${count}件`);
    } catch {
      console.log(`  ${table}: (アクセスエラー)`);
    }
  }

  // upload_jobs の詳細
  const { data: jobs } = await supabase
    .from('upload_jobs')
    .select('status')
    .limit(1000);

  if (jobs && jobs.length > 0) {
    const statusCounts: Record<string, number> = {};
    for (const job of jobs) {
      statusCounts[job.status] = (statusCounts[job.status] || 0) + 1;
    }
    console.log('\n  upload_jobs ステータス内訳:');
    for (const [status, count] of Object.entries(statusCounts)) {
      console.log(`    ${status}: ${count}件`);
    }
  }
}

// ========================================
// upload_jobs クリーンアップ
// ========================================

async function cleanupJobs() {
  console.log('\n🧹 upload_jobs クリーンアップ\n');

  // 現在の状態
  const { data: jobs } = await supabase.from('upload_jobs').select('*');

  if (!jobs || jobs.length === 0) {
    console.log('✅ upload_jobs は空です');
    return;
  }

  console.log(`現在 ${jobs.length}件のジョブがあります:`);
  for (const job of jobs) {
    console.log(`  - ${job.file_name} (${job.status})`);
  }

  const proceed = await confirm('\nすべてのジョブを削除しますか？');
  if (!proceed) {
    console.log('キャンセルしました');
    return;
  }

  const { error } = await supabase.from('upload_jobs').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('❌ エラー:', error.message);
  } else {
    console.log('✅ upload_jobs をクリアしました');
  }
}

// ========================================
// embedding_queue クリーンアップ
// ========================================

async function cleanupQueue() {
  console.log('\n🧹 embedding_queue クリーンアップ\n');

  const count = await getTableCount('embedding_queue');
  console.log(`現在 ${count}件のキューがあります`);

  if (count === 0) {
    console.log('✅ embedding_queue は空です');
    return;
  }

  const proceed = await confirm('すべてのキューを削除しますか？');
  if (!proceed) {
    console.log('キャンセルしました');
    return;
  }

  const { error } = await supabase.from('embedding_queue').delete().neq('id', '00000000-0000-0000-0000-000000000000');

  if (error) {
    console.error('❌ エラー:', error.message);
  } else {
    console.log('✅ embedding_queue をクリアしました');
  }
}

// ========================================
// 全データ削除
// ========================================

async function cleanupAll() {
  console.log('\n🚨 全データ削除\n');
  console.log('以下のテーブルのデータを削除します:');
  console.log('  - upload_jobs');
  console.log('  - embedding_queue');
  console.log('  - typical_examples');
  console.log('  - response_embeddings');
  console.log('  - responses');
  console.log('  - case_assignments');
  console.log('  - cases');
  console.log('\n⚠️  admin_users は削除しません');

  // 現在の件数
  console.log('\n現在のデータ件数:');
  const tables = ['upload_jobs', 'embedding_queue', 'typical_examples', 'response_embeddings', 'responses', 'case_assignments', 'cases'];
  for (const table of tables) {
    const count = await getTableCount(table);
    console.log(`  ${table}: ${count}件`);
  }

  const proceed = await confirm('\n本当にすべてのデータを削除しますか？ この操作は取り消せません');
  if (!proceed) {
    console.log('キャンセルしました');
    return;
  }

  const confirm2 = await confirm('本当に本当に削除しますか？ (yes を入力)');
  if (!confirm2) {
    console.log('キャンセルしました');
    return;
  }

  console.log('\n削除中...');

  // 依存関係の順序で削除（case_assignmentsはcasesへの外部キー制約あり）
  const deleteOrder = [
    'upload_jobs',
    'embedding_queue',
    'typical_examples',
    'response_embeddings',
    'responses',
    'case_assignments',
    'cases',
  ];

  for (const table of deleteOrder) {
    process.stdout.write(`  ${table}... `);
    const { error } = await supabase.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (error) {
      // case_id や response_id などの場合
      const { error: error2 } = await supabase.from(table).delete().neq('case_id', '');
      if (error2) {
        console.log(`❌ ${error2.message}`);
      } else {
        console.log('✅');
      }
    } else {
      console.log('✅');
    }
  }

  console.log('\n✅ 全データ削除完了');
}

// ========================================
// メイン
// ========================================

async function main() {
  const command = process.argv[2] || 'status';

  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║           データベースクリーンアップツール                 ║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  switch (command) {
    case 'status':
      await showStatus();
      break;
    case 'jobs':
      await cleanupJobs();
      break;
    case 'queue':
      await cleanupQueue();
      break;
    case 'all':
      await cleanupAll();
      break;
    default:
      console.log('\n使い方: npx tsx scripts/db-cleanup.ts [コマンド]');
      console.log('\nコマンド:');
      console.log('  status  - 現在の状態を表示 (デフォルト)');
      console.log('  jobs    - upload_jobs をクリア');
      console.log('  queue   - embedding_queue をクリア');
      console.log('  all     - 全データ削除（確認あり）');
  }

  console.log('');
}

main().catch(console.error);
