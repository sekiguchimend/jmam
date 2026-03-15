// CSVアップロードのServer Actions
// FR-07〜FR-11: CSVアップロード、検証、バッチ処理
// PE-02: 15万件のCSV処理を10分以内

'use server';

import {
  getDatasetStats,
  deleteResponsesByCaseId,
  getTotalResponseCount
} from '@/lib/supabase';
import type { DatasetStats } from '@/types';
import { isAdmin, getAccessToken } from '@/lib/supabase/server';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { getUserIdFromJwt } from '@/lib/jwt';

// ============================================
// CSVファイルアップロード（ハイブリッド方式）
// Server ActionでStorageへ保存 → API RouteでSSE処理
// ============================================

export type UploadJobResult = {
  success: boolean;
  jobId?: string;
  error?: string;
};

// CSVファイルをSupabase Storageにアップロードし、ジョブを作成
export async function uploadCsvToStorage(formData: FormData): Promise<UploadJobResult> {
  console.log('[uploadCsvToStorage] 開始');
  try {
    // 管理者チェック
    console.log('[uploadCsvToStorage] 管理者チェック');
    if (!(await isAdmin())) {
      console.log('[uploadCsvToStorage] 管理者権限なし');
      return { success: false, error: '管理者権限がありません' };
    }

    console.log('[uploadCsvToStorage] トークン取得');
    const token = await getAccessToken();
    if (!token) {
      console.log('[uploadCsvToStorage] トークンなし');
      return { success: false, error: '認証トークンが見つかりません（再ログインしてください）' };
    }

    const userId = getUserIdFromJwt(token);
    if (!userId) {
      console.log('[uploadCsvToStorage] ユーザーIDなし');
      return { success: false, error: 'ユーザーIDの取得に失敗しました' };
    }
    console.log('[uploadCsvToStorage] ユーザーID:', userId);

    const file = formData.get('file');
    console.log('[uploadCsvToStorage] ファイル取得:', file ? 'あり' : 'なし', file instanceof File ? `(${file.name}, ${file.size}bytes)` : '');
    if (!(file instanceof File)) {
      return { success: false, error: 'ファイルが選択されていません' };
    }

    if (!file.name.endsWith('.csv')) {
      return { success: false, error: 'CSVファイルのみアップロード可能です' };
    }

    // ファイルサイズチェック（100MB上限）
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return { success: false, error: 'ファイルサイズが100MBを超えています' };
    }

    const supabase = createAuthedAnonServerClient(token);

    // ファイルをStorageにアップロード
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `uploads/${userId}/${timestamp}_${safeName}`;
    console.log('[uploadCsvToStorage] ファイルパス:', filePath);

    console.log('[uploadCsvToStorage] arrayBuffer取得開始');
    const arrayBuffer = await file.arrayBuffer();
    console.log('[uploadCsvToStorage] arrayBuffer取得完了:', arrayBuffer.byteLength, 'bytes');

    console.log('[uploadCsvToStorage] Storage upload開始');
    const { error: uploadError } = await supabase.storage
      .from('csv-uploads')
      .upload(filePath, arrayBuffer, {
        contentType: 'text/csv',
        upsert: false,
      });

    if (uploadError) {
      console.error('[uploadCsvToStorage] Storage upload error:', uploadError);
      return { success: false, error: `ファイルのアップロードに失敗しました: ${uploadError.message}` };
    }
    console.log('[uploadCsvToStorage] Storage upload完了');

    // upload_jobsテーブルにジョブを作成
    console.log('[uploadCsvToStorage] ジョブ作成開始');
    const { data: job, error: jobError } = await supabase
      .from('upload_jobs')
      .insert({
        admin_user_id: userId,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        status: 'pending',
      })
      .select('id')
      .single();

    if (jobError || !job) {
      console.error('[uploadCsvToStorage] Job creation error:', jobError);
      // アップロード済みファイルを削除
      await supabase.storage.from('csv-uploads').remove([filePath]);
      return { success: false, error: `ジョブの作成に失敗しました: ${jobError?.message ?? 'unknown'}` };
    }
    console.log('[uploadCsvToStorage] ジョブ作成完了:', job.id);

    return { success: true, jobId: job.id };
  } catch (error) {
    console.error('[uploadCsvToStorage] 例外発生:', error);
    const errorMessage = error instanceof Error
      ? `${error.name}: ${error.message}`
      : String(error);
    return {
      success: false,
      error: `アップロード処理に失敗しました: ${errorMessage}`,
    };
  }
}

// データセット統計を取得（FR-12）
export async function fetchDatasetStats(): Promise<DatasetStats[]> {
  try {
    if (!(await isAdmin())) return [];
    return await getDatasetStats();
  } catch (error) {
    console.error('fetchDatasetStats error:', error);
    return [];
  }
}

// 総件数を取得
export async function fetchTotalCount(): Promise<number> {
  try {
    if (!(await isAdmin())) return 0;
    return await getTotalResponseCount();
  } catch (error) {
    console.error('fetchTotalCount error:', error);
    return 0;
  }
}

// ケースのデータを削除（FR-12）
export async function deleteDatasetByCaseId(caseId: string): Promise<{
  success: boolean;
  deletedCount?: number;
  error?: string;
}> {
  try {
    if (!(await isAdmin())) {
      return { success: false, error: '管理者権限がありません' };
    }
    const deletedCount = await deleteResponsesByCaseId(caseId);
    return { success: true, deletedCount };
  } catch (error) {
    console.error('deleteDatasetByCaseId error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'データの削除に失敗しました' 
    };
  }
}
