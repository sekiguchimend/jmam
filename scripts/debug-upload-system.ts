#!/usr/bin/env npx tsx
/**
 * アップロードシステムのデバッグスクリプト
 *
 * 使い方:
 *   npx tsx scripts/debug-upload-system.ts
 *   npx tsx scripts/debug-upload-system.ts --cleanup  # スタックしたジョブをクリア
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ 環境変数が設定されていません');
  console.error('   NEXT_PUBLIC_SUPABASE_URL:', supabaseUrl ? '✓' : '✗');
  console.error('   SUPABASE_SERVICE_ROLE_KEY:', serviceRoleKey ? '✓' : '✗');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

// ========================================
// ユーティリティ
// ========================================

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  return d.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
}

function formatElapsed(dateStr: string): string {
  const elapsed = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(elapsed / 1000 / 60);
  const hours = Math.floor(minutes / 60);
  if (hours > 0) return `${hours}時間${minutes % 60}分前`;
  return `${minutes}分前`;
}

// ========================================
// 1. upload_jobs テーブルの状態確認
// ========================================

async function checkUploadJobs() {
  console.log('\n' + '='.repeat(60));
  console.log('📦 upload_jobs テーブルの状態');
  console.log('='.repeat(60));

  // 全ジョブ数
  const { count: totalCount } = await supabase
    .from('upload_jobs')
    .select('*', { count: 'exact', head: true });

  console.log(`\n総ジョブ数: ${totalCount ?? 0}件`);

  // ステータス別カウント
  const statuses = ['pending', 'processing', 'completed', 'error'];
  console.log('\n【ステータス別】');
  for (const status of statuses) {
    const { count } = await supabase
      .from('upload_jobs')
      .select('*', { count: 'exact', head: true })
      .eq('status', status);
    const icon = status === 'pending' ? '⏳' :
                 status === 'processing' ? '🔄' :
                 status === 'completed' ? '✅' : '❌';
    console.log(`  ${icon} ${status}: ${count ?? 0}件`);
  }

  // 最新10件のジョブ
  const { data: recentJobs, error } = await supabase
    .from('upload_jobs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('\n❌ ジョブ取得エラー:', error.message);
    return;
  }

  console.log('\n【最新10件のジョブ】');
  if (!recentJobs || recentJobs.length === 0) {
    console.log('  (ジョブがありません)');
    return;
  }

  for (const job of recentJobs) {
    const statusIcon = job.status === 'pending' ? '⏳' :
                       job.status === 'processing' ? '🔄' :
                       job.status === 'completed' ? '✅' : '❌';
    console.log(`\n  ${statusIcon} ${job.file_name}`);
    console.log(`     ID: ${job.id}`);
    console.log(`     ステータス: ${job.status}`);
    console.log(`     処理行数: ${job.processed_rows ?? 0} / ${job.total_rows ?? '?'}`);
    console.log(`     作成: ${formatDate(job.created_at)} (${formatElapsed(job.created_at)})`);
    console.log(`     更新: ${formatDate(job.updated_at)} (${formatElapsed(job.updated_at)})`);
    if (job.error_message) {
      console.log(`     ❌ エラー: ${job.error_message}`);
    }
    if (job.prepare_status) {
      console.log(`     事前準備: ${job.prepare_status}`);
      console.log(`       埋め込み: ${job.embedding_succeeded}成功 / ${job.embedding_failed}失敗`);
      console.log(`       典型例: ${job.typicals_done} / ${job.typicals_total}`);
    }
  }

  // 問題のあるジョブを検出
  console.log('\n【⚠️ 問題の可能性があるジョブ】');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: staleJobs } = await supabase
    .from('upload_jobs')
    .select('*')
    .in('status', ['pending', 'processing'])
    .lt('updated_at', oneHourAgo);

  if (staleJobs && staleJobs.length > 0) {
    console.log(`  🚨 1時間以上更新がないpending/processingジョブ: ${staleJobs.length}件`);
    for (const job of staleJobs) {
      console.log(`     - ${job.file_name} (${job.status}, ${formatElapsed(job.updated_at)})`);
    }
  } else {
    console.log('  ✅ スタックしたジョブはありません');
  }
}

// ========================================
// 2. cases テーブルの状態確認
// ========================================

async function checkCases() {
  console.log('\n' + '='.repeat(60));
  console.log('📁 cases テーブルの状態');
  console.log('='.repeat(60));

  const { count: totalCount, error } = await supabase
    .from('cases')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  console.log(`\n総ケース数: ${totalCount ?? 0}件`);

  // ケース一覧
  const { data: cases } = await supabase
    .from('cases')
    .select('case_id, case_name, file_name, created_at')
    .order('created_at', { ascending: false })
    .limit(20);

  if (cases && cases.length > 0) {
    console.log('\n【最新20件のケース】');
    for (const c of cases) {
      console.log(`  - ${c.case_id}: ${c.case_name ?? '(名前なし)'}`);
      console.log(`    ファイル: ${c.file_name ?? '-'}, 作成: ${formatDate(c.created_at)}`);
    }
  }
}

// ========================================
// 3. responses テーブルの状態確認
// ========================================

async function checkResponses() {
  console.log('\n' + '='.repeat(60));
  console.log('📝 responses テーブルの状態');
  console.log('='.repeat(60));

  const { count: totalCount, error } = await supabase
    .from('responses')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  console.log(`\n総レスポンス数: ${totalCount ?? 0}件`);

  // ケース別の件数
  const { data: caseStats } = await supabase
    .from('responses')
    .select('case_id')
    .limit(10000);

  if (caseStats) {
    const caseCounts: Record<string, number> = {};
    for (const r of caseStats) {
      caseCounts[r.case_id] = (caseCounts[r.case_id] || 0) + 1;
    }

    console.log('\n【ケース別レスポンス数】');
    const sorted = Object.entries(caseCounts).sort((a, b) => b[1] - a[1]);
    for (const [caseId, count] of sorted.slice(0, 10)) {
      console.log(`  - ${caseId}: ${count}件`);
    }
    if (sorted.length > 10) {
      console.log(`  ... 他 ${sorted.length - 10}ケース`);
    }
  }

  // スコアの分布
  console.log('\n【スコアデータの有無】');
  const scoreColumns = [
    'score_problem', 'score_solution', 'score_role',
    'score_leadership', 'score_collaboration', 'score_development'
  ];
  for (const col of scoreColumns) {
    const { count } = await supabase
      .from('responses')
      .select('*', { count: 'exact', head: true })
      .not(col, 'is', null);
    console.log(`  ${col}: ${count ?? 0}件`);
  }
}

// ========================================
// 4. embeddings テーブルの状態確認
// ========================================

async function checkEmbeddings() {
  console.log('\n' + '='.repeat(60));
  console.log('🧮 response_embeddings テーブルの状態');
  console.log('='.repeat(60));

  const { count: totalCount, error } = await supabase
    .from('response_embeddings')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  console.log(`\n総埋め込み数: ${totalCount ?? 0}件`);

  // question別
  for (const q of ['q1', 'q2']) {
    const { count } = await supabase
      .from('response_embeddings')
      .select('*', { count: 'exact', head: true })
      .eq('question', q);
    console.log(`  ${q}: ${count ?? 0}件`);
  }
}

// ========================================
// 5. embedding_queue テーブルの状態確認
// ========================================

async function checkEmbeddingQueue() {
  console.log('\n' + '='.repeat(60));
  console.log('📋 embedding_queue テーブルの状態');
  console.log('='.repeat(60));

  const { count: totalCount, error } = await supabase
    .from('embedding_queue')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  console.log(`\n未処理キュー: ${totalCount ?? 0}件`);

  if (totalCount && totalCount > 0) {
    console.log('  ⚠️ 未処理の埋め込みジョブがあります');

    // 最古のジョブ
    const { data: oldest } = await supabase
      .from('embedding_queue')
      .select('*')
      .order('created_at', { ascending: true })
      .limit(1)
      .single();

    if (oldest) {
      console.log(`  最古のジョブ: ${formatDate(oldest.created_at)} (${formatElapsed(oldest.created_at)})`);
    }
  } else {
    console.log('  ✅ キューは空です');
  }
}

// ========================================
// 6. typical_examples テーブルの状態確認
// ========================================

async function checkTypicalExamples() {
  console.log('\n' + '='.repeat(60));
  console.log('⭐ typical_examples テーブルの状態');
  console.log('='.repeat(60));

  const { count: totalCount, error } = await supabase
    .from('typical_examples')
    .select('*', { count: 'exact', head: true });

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  console.log(`\n総典型例数: ${totalCount ?? 0}件`);

  // ケース・質問・バケット別
  const { data: examples } = await supabase
    .from('typical_examples')
    .select('case_id, question, score_bucket')
    .limit(1000);

  if (examples && examples.length > 0) {
    const buckets: Record<string, number> = {};
    for (const e of examples) {
      const key = `${e.case_id}/${e.question}/${e.score_bucket}`;
      buckets[key] = (buckets[key] || 0) + 1;
    }
    console.log(`\n【ユニークなバケット数】: ${Object.keys(buckets).length}`);
  }
}

// ========================================
// 7. admin_users テーブルの状態確認
// ========================================

async function checkAdminUsers() {
  console.log('\n' + '='.repeat(60));
  console.log('👤 admin_users テーブルの状態');
  console.log('='.repeat(60));

  const { data: admins, error } = await supabase
    .from('admin_users')
    .select('id, email, is_active, created_at');

  if (error) {
    console.error('❌ エラー:', error.message);
    return;
  }

  console.log(`\n管理者数: ${admins?.length ?? 0}人`);

  if (admins && admins.length > 0) {
    for (const admin of admins) {
      const status = admin.is_active ? '✅ 有効' : '❌ 無効';
      console.log(`  ${status} ${admin.email}`);
    }
  }
}

// ========================================
// 8. 整合性チェック
// ========================================

async function checkIntegrity() {
  console.log('\n' + '='.repeat(60));
  console.log('🔍 データ整合性チェック');
  console.log('='.repeat(60));

  let issues = 0;

  // responsesにあるcase_idがcasesに存在するか
  const { data: responses } = await supabase
    .from('responses')
    .select('case_id')
    .limit(10000);

  const { data: cases } = await supabase
    .from('cases')
    .select('case_id');

  if (responses && cases) {
    const caseIds = new Set(cases.map(c => c.case_id));
    const orphanCaseIds = new Set<string>();
    for (const r of responses) {
      if (!caseIds.has(r.case_id)) {
        orphanCaseIds.add(r.case_id);
      }
    }
    if (orphanCaseIds.size > 0) {
      console.log(`\n⚠️ casesに存在しないcase_idを持つresponses: ${orphanCaseIds.size}種類`);
      for (const id of Array.from(orphanCaseIds).slice(0, 5)) {
        console.log(`   - ${id}`);
      }
      issues++;
    } else {
      console.log('\n✅ すべてのresponsesのcase_idがcasesに存在します');
    }
  }

  // embeddingsにあるresponse_idがresponsesに存在するか
  const { data: embeddings } = await supabase
    .from('response_embeddings')
    .select('response_id')
    .limit(10000);

  const { data: allResponses } = await supabase
    .from('responses')
    .select('response_id')
    .limit(100000);

  if (embeddings && allResponses) {
    const responseIds = new Set(allResponses.map(r => r.response_id));
    const orphanEmbeddings = embeddings.filter(e => !responseIds.has(e.response_id));
    if (orphanEmbeddings.length > 0) {
      console.log(`\n⚠️ responsesに存在しないresponse_idを持つembeddings: ${orphanEmbeddings.length}件`);
      issues++;
    } else {
      console.log('✅ すべてのembeddingsのresponse_idがresponsesに存在します');
    }
  }

  // upload_jobsの状態
  const { data: stuckJobs } = await supabase
    .from('upload_jobs')
    .select('*')
    .in('status', ['pending', 'processing']);

  if (stuckJobs && stuckJobs.length > 0) {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const stale = stuckJobs.filter(j => new Date(j.updated_at).getTime() < oneHourAgo);
    if (stale.length > 0) {
      console.log(`\n⚠️ スタックしたupload_jobs: ${stale.length}件`);
      issues++;
    }
  }

  console.log(`\n${'='.repeat(40)}`);
  if (issues === 0) {
    console.log('✅ すべてのチェックに合格しました');
  } else {
    console.log(`⚠️ ${issues}件の問題が見つかりました`);
  }
}

// ========================================
// 9. スタックしたジョブをクリーンアップ
// ========================================

async function cleanupStaleJobs() {
  console.log('\n' + '='.repeat(60));
  console.log('🧹 スタックしたジョブのクリーンアップ');
  console.log('='.repeat(60));

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { data: staleJobs } = await supabase
    .from('upload_jobs')
    .select('id, file_name, status, updated_at')
    .in('status', ['pending', 'processing'])
    .lt('updated_at', oneHourAgo);

  if (!staleJobs || staleJobs.length === 0) {
    console.log('\n✅ クリーンアップが必要なジョブはありません');
    return;
  }

  console.log(`\n⚠️ ${staleJobs.length}件のスタックしたジョブを検出`);
  for (const job of staleJobs) {
    console.log(`  - ${job.file_name} (${job.status}, ${formatElapsed(job.updated_at)})`);
  }

  // クリーンアップ実行
  const { error } = await supabase
    .from('upload_jobs')
    .update({
      status: 'error',
      error_message: 'タイムアウト: デバッグスクリプトによりクリーンアップ',
    })
    .in('status', ['pending', 'processing'])
    .lt('updated_at', oneHourAgo);

  if (error) {
    console.error('❌ クリーンアップエラー:', error.message);
  } else {
    console.log('\n✅ クリーンアップ完了');
  }
}

// ========================================
// メイン
// ========================================

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║         アップロードシステム デバッグレポート              ║');
  console.log('║         ' + new Date().toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' }).padEnd(40) + '║');
  console.log('╚════════════════════════════════════════════════════════════╝');

  const args = process.argv.slice(2);
  const cleanupMode = args.includes('--cleanup');

  try {
    await checkUploadJobs();
    await checkCases();
    await checkResponses();
    await checkEmbeddings();
    await checkEmbeddingQueue();
    await checkTypicalExamples();
    await checkAdminUsers();
    await checkIntegrity();

    if (cleanupMode) {
      await cleanupStaleJobs();
    } else {
      console.log('\n💡 スタックしたジョブをクリーンアップするには:');
      console.log('   npx tsx scripts/debug-upload-system.ts --cleanup');
    }

    console.log('\n' + '='.repeat(60));
    console.log('デバッグレポート完了');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('\n❌ エラー:', error);
    process.exit(1);
  }
}

main();
