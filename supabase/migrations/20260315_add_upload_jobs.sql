-- CSVアップロードジョブ管理テーブル
-- ハイブリッドアップロード: Server ActionでStorage保存 → API RouteでSSE進捗

CREATE TABLE IF NOT EXISTS upload_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_path text NOT NULL,  -- Supabase Storageのパス
  file_size bigint NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'error')),

  -- 進捗情報
  total_rows int,
  processed_rows int DEFAULT 0,
  error_message text,
  errors jsonb DEFAULT '[]'::jsonb,

  -- 事前準備（embedding/典型例）の進捗
  prepare_status text CHECK (prepare_status IN ('pending', 'processing', 'completed', 'skipped')),
  embedding_processed int DEFAULT 0,
  embedding_succeeded int DEFAULT 0,
  embedding_failed int DEFAULT 0,
  typicals_done int DEFAULT 0,
  typicals_total int DEFAULT 0,

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_upload_jobs_admin_user ON upload_jobs(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_status ON upload_jobs(status);
CREATE INDEX IF NOT EXISTS idx_upload_jobs_created_at ON upload_jobs(created_at DESC);

-- RLS
ALTER TABLE upload_jobs ENABLE ROW LEVEL SECURITY;

-- 管理者のみアクセス可能
CREATE POLICY "admin_users can manage upload_jobs"
  ON upload_jobs
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM admin_users
      WHERE admin_users.id = auth.uid()
      AND admin_users.is_active = true
    )
  );

-- updated_atの自動更新トリガー
CREATE OR REPLACE FUNCTION update_upload_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_upload_jobs_updated_at
  BEFORE UPDATE ON upload_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_upload_jobs_updated_at();

-- Storageバケットの作成（存在しない場合）
-- 注: Supabaseダッシュボードで手動作成が必要な場合があります
-- バケット名: csv-uploads
-- 公開設定: private
-- ファイルサイズ上限: 100MB
