-- 重複を許可するためUNIQUE制約を削除
ALTER TABLE responses
DROP CONSTRAINT IF EXISTS responses_case_response_unique;
