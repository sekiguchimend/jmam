-- 自由形式質問（マネジメント相談）機能のサポート追加
-- prediction_history テーブルに result_suggestions カラムを追加

-- 追加の提案を保存するカラムを追加
ALTER TABLE prediction_history
ADD COLUMN IF NOT EXISTS result_suggestions text[] DEFAULT NULL;

-- 履歴検索のパフォーマンス向上のためのインデックス
CREATE INDEX IF NOT EXISTS idx_prediction_history_type_free
ON prediction_history (prediction_type)
WHERE prediction_type = 'free_question';

-- コメント追加
COMMENT ON COLUMN prediction_history.result_suggestions IS '自由形式質問モードでのAIからの追加提案（配列）';
