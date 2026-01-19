-- スコア予測機能用のPostgreSQL関数
-- Supabaseのダッシュボードで実行してください

-- 類似回答検索関数（コメント付き）
-- p_question: 'q1' (設問1 = answer_q1) または 'q2' (設問2 = answer_q2〜q8を結合)
CREATE OR REPLACE FUNCTION find_similar_responses_for_scoring(
  p_embedding vector(3072),
  p_case_id text,
  p_question text,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  response_id text,
  score double precision,
  similarity double precision,
  answer_text text,
  comment_problem text,
  comment_solution text,
  comment_overall text
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    re.response_id,
    COALESCE(
      CASE
        WHEN p_question = 'q1' THEN r.score_problem
        WHEN p_question = 'q2' THEN r.score_solution
        ELSE r.score_overall
      END,
      0.0
    ) as score,
    1 - (re.embedding <=> p_embedding) as similarity,
    COALESCE(
      CASE
        WHEN p_question = 'q1' THEN r.answer_q1
        WHEN p_question = 'q2' THEN CONCAT_WS(E'\n',
          NULLIF(r.answer_q2, ''),
          NULLIF(r.answer_q3, ''),
          NULLIF(r.answer_q4, ''),
          NULLIF(r.answer_q5, ''),
          NULLIF(r.answer_q6, ''),
          NULLIF(r.answer_q7, ''),
          NULLIF(r.answer_q8, '')
        )
        ELSE r.answer_q1
      END,
      ''
    ) as answer_text,
    r.comment_problem,
    r.comment_solution,
    r.comment_overall
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

-- 類似ケース検索関数
CREATE OR REPLACE FUNCTION find_similar_cases(
  p_embedding vector(3072),
  p_limit INT DEFAULT 5
)
RETURNS TABLE (
  case_id TEXT,
  case_name TEXT,
  situation_text TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    c.case_id,
    c.case_name,
    c.situation_text,
    1 - (c.situation_embedding <=> p_embedding) AS similarity
  FROM cases c
  WHERE c.situation_embedding IS NOT NULL
  ORDER BY c.situation_embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;

-- 複数ケースからの類似回答検索関数（コメント付き）
CREATE OR REPLACE FUNCTION find_similar_responses_cross_cases(
  p_embedding vector(3072),
  p_case_ids TEXT[],
  p_question TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  response_id TEXT,
  case_id TEXT,
  case_name TEXT,
  score FLOAT,
  similarity FLOAT,
  answer_text TEXT,
  comment_problem TEXT,
  comment_solution TEXT,
  comment_overall TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    r.response_id,
    r.case_id,
    c.case_name,
    CASE
      WHEN p_question = 'q1' THEN COALESCE(r.score_problem, r.score_overall)
      ELSE COALESCE(r.score_solution, r.score_overall)
    END AS score,
    1 - (re.embedding <=> p_embedding) AS similarity,
    CASE
      WHEN p_question = 'q1' THEN r.answer_q1
      ELSE CONCAT_WS(E'\n', r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8)
    END AS answer_text,
    r.comment_problem,
    r.comment_solution,
    r.comment_overall
  FROM response_embeddings re
  JOIN responses r ON r.case_id = re.case_id AND r.response_id = re.response_id
  JOIN cases c ON c.case_id = r.case_id
  WHERE re.case_id = ANY(p_case_ids)
    AND re.question = p_question
    AND re.embedding IS NOT NULL
  ORDER BY re.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;
