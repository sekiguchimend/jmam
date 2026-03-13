-- 1. 重複データを削除（各 case_id + response_id で最新の1件のみ残す）
DELETE FROM responses
WHERE id NOT IN (
  SELECT DISTINCT ON (case_id, response_id) id
  FROM responses
  ORDER BY case_id, response_id, updated_at DESC NULLS LAST, created_at DESC NULLS LAST
);

-- 2. ユニーク制約を追加
ALTER TABLE responses
ADD CONSTRAINT responses_case_response_unique
UNIQUE (case_id, response_id);
