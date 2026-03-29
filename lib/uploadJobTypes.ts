// アップロードジョブの型定義と定数
// クライアント・サーバー両方で使用可能

export type UploadJobStatus = 'pending' | 'processing' | 'completed' | 'error';
export type PrepareStatus = 'pending' | 'processing' | 'completed' | 'skipped';

// キャンセル時のエラーメッセージ
export const CANCELLED_MESSAGE = 'ユーザーによりキャンセルされました';

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
