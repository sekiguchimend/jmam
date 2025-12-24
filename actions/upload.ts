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
import { isAdmin } from '@/lib/supabase/server';

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
