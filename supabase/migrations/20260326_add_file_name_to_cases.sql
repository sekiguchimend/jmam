-- cases テーブルにファイル名カラムを追加
-- データセット一覧でファイル名を表示するため

ALTER TABLE cases ADD COLUMN IF NOT EXISTS file_name text;

-- コメント追加
COMMENT ON COLUMN cases.file_name IS 'アップロード元のCSVファイル名';
