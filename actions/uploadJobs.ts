// アップロードジョブ管理のServer Actions
// バックグラウンドアップロードの状態管理

'use server';

import { isAdmin, getAuthedUserId } from '@/lib/supabase/server';
import {
  type UploadJobStatus,
  type PrepareStatus,
  CANCELLED_MESSAGE,
} from '@/lib/uploadJobUtils';

// 型とメッセージを再エクスポート
export type { UploadJobStatus, PrepareStatus };
export { CANCELLED_MESSAGE };

export interface UploadJob {
  id: string;
  file_name: string;
  file_size: number;
  status: UploadJobStatus;
  total_rows: number | null;
  processed_rows: number;
  error_message: string | null;
  errors: string[];
  prepare_status: PrepareStatus | null;
  embedding_processed: number;
  embedding_succeeded: number;
  embedding_failed: number;
  typicals_done: number;
  typicals_total: number;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

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

    // 実行中のジョブ、または過去1時間以内に完了/エラーになったジョブを取得
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();

    const { data, error } = await supabaseServiceRole
      .from('upload_jobs')
      .select('*')
      .or(`status.in.(pending,processing),and(status.in.(completed,error),updated_at.gte.${oneHourAgo})`)
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ジョブの取得に失敗しました',
    };
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

    // 実行中のジョブがあればエラー
    const { data: existingJob } = await supabaseServiceRole
      .from('upload_jobs')
      .select('id')
      .in('status', ['pending', 'processing'])
      .limit(1)
      .single();

    if (existingJob) {
      return { success: false, error: '別のアップロードが実行中です' };
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ジョブの作成に失敗しました',
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
    return {
      success: false,
      error: error instanceof Error ? error.message : 'キャンセルに失敗しました',
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

    // 1時間前の日時に更新して非表示にする
    const oldDate = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const { error } = await supabaseServiceRole
      .from('upload_jobs')
      .update({ updated_at: oldDate })
      .eq('id', jobId);

    if (error) {
      console.error('dismissUploadJob error:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('dismissUploadJob error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'ジョブのクリアに失敗しました',
    };
  }
}
