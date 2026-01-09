-- スコア予測機能用のPostgreSQL関数
-- Supabaseのダッシュボードで実行してください

-- 類似回答検索関数
CREATE OR REPLACE FUNCTION find_similar_responses_for_scoring(
  p_embedding vector(768),
  p_case_id text,
  p_question text,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  response_id text,
  score double precision,
  similarity double precision,
  answer_text text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.response_id,
    COALESCE(
      CASE
        WHEN p_question = 'problem' THEN r.score_problem
        WHEN p_question = 'solution' THEN r.score_solution
        ELSE r.score_overall
      END,
      0.0
    ) as score,
    1 - (re.embedding <=> p_embedding) as similarity,
    COALESCE(
      CASE
        WHEN p_question = 'problem' THEN r.answer_q1
        WHEN p_question = 'solution' THEN r.answer_q2
        ELSE r.answer_q1
      END,
      ''
    ) as answer_text
  FROM response_embeddings re
  JOIN responses r ON re.case_id = r.case_id AND re.response_id = r.response_id
  WHERE
    re.case_id = p_case_id
    AND re.question = p_question
    AND re.embedding IS NOT NULL
  ORDER BY re.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;
