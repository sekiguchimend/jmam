-- responses テーブルのユニーク制約を削除
-- 同じ case_id + response_id でも別レコードとして保存できるようにする
ALTER TABLE responses
DROP CONSTRAINT IF EXISTS responses_case_response_unique;
