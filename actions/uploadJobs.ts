// アップロードジョブ管理のServer Actions
// バックグラウンドアップロードの状態管理

'use server';

import { isAdmin, getAuthedUserId } from '@/lib/supabase/server';
import { CANCELLED_MESSAGE, DISMISSED_MARKER, type UploadJob } from '@/lib/uploadJobTypes';

// 実行中または最近完了したジョブを取得（Service Role版）
export async function getActiveUploadJob(): Promise<{
  success: boolean;
  job?: UploadJob;
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    // Service Roleを使用（JWT期限切れの影響を受けない）
    const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

    // 古いスタックしたジョブを自動クリーンアップ
    await cleanupStaleJobs();

    // 実行中のジョブ（1時間以内）、または過去1時間以内に完了/エラーになったジョブを取得
    // dismissedジョブは除外
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseServiceRole
      .from('upload_jobs')
      .select('*')
      .gte('updated_at', oneHourAgo)
      .or(`error_message.is.null,error_message.neq.${DISMISSED_MARKER}`)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return { success: true, job: undefined };
      }
      console.error('getActiveUploadJob error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, job: data as UploadJob };
  } catch (error) {
    console.error('getActiveUploadJob error:', error);
    // セキュリティ: 内部エラー詳細はログのみ、ユーザーには汎用メッセージ
    return {
      success: false,
      error: 'ジョブの取得に失敗しました',
    };
  }
}

// 古いスタックしたジョブをクリーンアップ（1時間以上経過したpending/processingジョブ）
async function cleanupStaleJobs(): Promise<void> {
  const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

  const { error } = await supabaseServiceRole
    .from('upload_jobs')
    .update({
      status: 'error',
      error_message: 'タイムアウト: 処理が1時間以上停止していたためエラーとしました',
    })
    .in('status', ['pending', 'processing'])
    .lt('updated_at', oneHourAgo);

  if (error) {
    console.error('cleanupStaleJobs error:', error);
  }
}

// ジョブを作成（Service Role版）
export async function createUploadJob(params: {
  fileName: string;
  fileSize: number;
}): Promise<{
  success: boolean;
  jobId?: string;
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    // ユーザーIDを取得
    const userId = await getAuthedUserId();
    if (!userId) {
      return { success: false, error: 'ユーザーIDが取得できません' };
    }

    // Service Roleを使用（JWT期限切れの影響を受けない）
    const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

    // 古いスタックしたジョブを自動クリーンアップ
    await cleanupStaleJobs();

    // 実行中のジョブがあればエラー（クリーンアップ後に再確認）
    const { data: existingJob } = await supabaseServiceRole
      .from('upload_jobs')
      .select('id, file_name, created_at')
      .in('status', ['pending', 'processing'])
      .limit(1)
      .single();

    if (existingJob) {
      const createdAt = new Date(existingJob.created_at);
      const elapsed = Math.round((Date.now() - createdAt.getTime()) / 1000 / 60);
      return {
        success: false,
        error: `別のアップロード（${existingJob.file_name}）が実行中です（${elapsed}分経過）`
      };
    }

    // 新しいジョブを作成
    const { data, error } = await supabaseServiceRole
      .from('upload_jobs')
      .insert({
        admin_user_id: userId,
        file_name: params.fileName,
        file_path: '', // 直接処理なのでパスは不要
        file_size: params.fileSize,
        status: 'pending',
      })
      .select('id')
      .single();

    if (error) {
      console.error('createUploadJob error:', error);
      return { success: false, error: error.message };
    }

    return { success: true, jobId: data.id };
  } catch (error) {
    console.error('createUploadJob error:', error);
    // セキュリティ: 内部エラー詳細はログのみ、ユーザーには汎用メッセージ
    return {
      success: false,
      error: 'ジョブの作成に失敗しました',
    };
  }
}

// ジョブをキャンセル（Service Role版）
// error ステータスで CANCELLED_MESSAGE をセットしてキャンセルを表す
export async function cancelUploadJob(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

    const { error } = await supabaseServiceRole
      .from('upload_jobs')
      .update({
        status: 'error',
        error_message: CANCELLED_MESSAGE,
        updated_at: new Date().toISOString(), // 明示的に更新してgetActiveUploadJobで取得可能にする
      })
      .eq('id', jobId)
      .in('status', ['pending', 'processing']);

    if (error) {
      console.error('cancelUploadJob error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('cancelUploadJob error:', error);
    // セキュリティ: 内部エラー詳細はログのみ、ユーザーには汎用メッセージ
    return {
      success: false,
      error: 'キャンセルに失敗しました',
    };
  }
}

// ジョブをクリア（完了後に非表示にする）（Service Role版）
export async function dismissUploadJob(jobId: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }

    // Service Roleを使用（JWT期限切れの影響を受けない）
    const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

    // error_messageにDISMISSED_MARKERを設定してgetActiveUploadJobから除外
    // statusがerrorでない場合もerrorに変更（completedの場合など）
    const { error } = await supabaseServiceRole
      .from('upload_jobs')
      .update({
        status: 'error',
        error_message: DISMISSED_MARKER,
      })
      .eq('id', jobId);

    if (error) {
      console.error('dismissUploadJob error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('dismissUploadJob error:', error);
    // セキュリティ: 内部エラー詳細はログのみ、ユーザーには汎用メッセージ
    return {
      success: false,
      error: 'ジョブのクリアに失敗しました',
    };
  }
}
