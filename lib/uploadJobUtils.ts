// アップロードジョブのユーティリティ関数
// Server ActionsとAPI Routeの両方から使用される

import 'server-only';

export type UploadJobStatus = 'pending' | 'processing' | 'completed' | 'error';
export type PrepareStatus = 'pending' | 'processing' | 'completed' | 'skipped';

// キャンセル時のエラーメッセージ（これでキャンセルかどうかを判定）
export const CANCELLED_MESSAGE = 'ユーザーによりキャンセルされました';

// ジョブを更新（Service Role版 - JWT期限切れの影響を受けない）
export async function updateUploadJobServiceRole(
  jobId: string,
  updates: Partial<{
    status: UploadJobStatus;
    total_rows: number;
    processed_rows: number;
    error_message: string;
    errors: string[];
    prepare_status: PrepareStatus;
    embedding_processed: number;
    embedding_succeeded: number;
    embedding_failed: number;
    typicals_done: number;
    typicals_total: number;
    completed_at: string;
  }>
): Promise<void> {
  // Dynamic importでservice roleクライアントを取得（server-only対応）
  const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

  const { error } = await supabaseServiceRole
    .from('upload_jobs')
    .update(updates)
    .eq('id', jobId);

  if (error) {
    console.error('updateUploadJobServiceRole error:', error);
    throw new Error(`ジョブの更新に失敗しました: ${error.message}`);
  }
}

// ジョブのキャンセル状態を確認（Service Role版）
export async function isJobCancelled(jobId: string): Promise<boolean> {
  try {
    const { supabaseServiceRole } = await import('@/lib/supabase/service-role');

    const { data } = await supabaseServiceRole
      .from('upload_jobs')
      .select('status,error_message')
      .eq('id', jobId)
      .single();

    return data?.status === 'error' && data?.error_message === CANCELLED_MESSAGE;
  } catch {
    return false;
  }
}
