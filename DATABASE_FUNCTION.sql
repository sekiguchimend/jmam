-- スコア予測機能用のPostgreSQL関数
-- Supabaseのダッシュボードで実行してください

-- 類似回答検索関数（コメント付き、全スコアフィールド対応）
-- p_question: 'q1' (設問1 = answer_q1) または 'q2' (設問2 = answer_q2〜q8を結合)
CREATE OR REPLACE FUNCTION find_similar_responses_for_scoring(
  p_embedding vector(3072),
  p_case_id text,
  p_question text,
  p_limit int DEFAULT 10
)
RETURNS TABLE (
  response_id text,
  score_overall double precision,
  score_problem double precision,
  score_solution double precision,
  score_leadership double precision,
  score_collaboration double precision,
  score_development double precision,
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
    re.response_id::text,
    r.score_overall,
    r.score_problem,
    r.score_solution,
    r.score_leadership,
    r.score_collaboration,
    r.score_development,
    (1 - (re.embedding <=> p_embedding))::double precision as similarity,
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
    )::text as answer_text,
    r.comment_problem::text,
    r.comment_solution::text,
    r.comment_overall::text
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
    c.case_id::text,
    c.case_name::text,
    c.situation_text::text,
    (1 - (c.situation_embedding <=> p_embedding))::float AS similarity
  FROM cases c
  WHERE c.situation_embedding IS NOT NULL
  ORDER BY c.situation_embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;

-- 複数ケースからの類似回答検索関数（コメント付き、全スコアフィールド対応）
CREATE OR REPLACE FUNCTION find_similar_responses_cross_cases(
  p_embedding vector(3072),
  p_question TEXT,
  p_limit INT DEFAULT 10
)
RETURNS TABLE (
  response_id TEXT,
  case_id TEXT,
  case_name TEXT,
  score_overall DOUBLE PRECISION,
  score_problem DOUBLE PRECISION,
  score_solution DOUBLE PRECISION,
  score_leadership DOUBLE PRECISION,
  score_collaboration DOUBLE PRECISION,
  score_development DOUBLE PRECISION,
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
    r.response_id::text,
    r.case_id::text,
    c.case_name::text,
    r.score_overall,
    r.score_problem,
    r.score_solution,
    r.score_leadership,
    r.score_collaboration,
    r.score_development,
    (1 - (re.embedding <=> p_embedding))::float AS similarity,
    (CASE
      WHEN p_question = 'q1' THEN r.answer_q1
      ELSE CONCAT_WS(E'\n', r.answer_q2, r.answer_q3, r.answer_q4, r.answer_q5, r.answer_q6, r.answer_q7, r.answer_q8)
    END)::text AS answer_text,
    r.comment_problem::text,
    r.comment_solution::text,
    r.comment_overall::text
  FROM response_embeddings re
  JOIN responses r ON r.case_id = re.case_id AND r.response_id = re.response_id
  JOIN cases c ON c.case_id = r.case_id
  WHERE re.question = p_question
    AND re.embedding IS NOT NULL
  ORDER BY re.embedding <=> p_embedding
  LIMIT p_limit;
END;
$$;

-- ============================================
-- スコア分布テーブル（不均衡データ対策）
-- ============================================

-- スコア分布を保存するテーブル
CREATE TABLE IF NOT EXISTS score_distribution (
  case_id TEXT NOT NULL,
  question TEXT NOT NULL,
  score_field TEXT NOT NULL,
  score_bucket NUMERIC NOT NULL,
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (case_id, question, score_field, score_bucket)
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_score_distribution_lookup
ON score_distribution(case_id, question, score_field);

-- スコア分布を計算・更新する関数
CREATE OR REPLACE FUNCTION update_score_distribution(
  p_case_id TEXT,
  p_question TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 既存のデータを削除
  DELETE FROM score_distribution
  WHERE case_id = p_case_id AND question = p_question;

  -- 総合評点の分布を計算
  INSERT INTO score_distribution (case_id, question, score_field, score_bucket, sample_count)
  SELECT
    p_case_id,
    p_question,
    'overall',
    ROUND((score_overall * 2)::numeric) / 2,
    COUNT(*)
  FROM responses
  WHERE case_id = p_case_id
    AND score_overall IS NOT NULL
  GROUP BY ROUND((score_overall * 2)::numeric) / 2;

  -- 問題把握の分布を計算
  INSERT INTO score_distribution (case_id, question, score_field, score_bucket, sample_count)
  SELECT
    p_case_id,
    p_question,
    'problem',
    ROUND((score_problem * 2)::numeric) / 2,
    COUNT(*)
  FROM responses
  WHERE case_id = p_case_id
    AND score_problem IS NOT NULL
  GROUP BY ROUND((score_problem * 2)::numeric) / 2;

  -- 対策立案の分布を計算
  INSERT INTO score_distribution (case_id, question, score_field, score_bucket, sample_count)
  SELECT
    p_case_id,
    p_question,
    'solution',
    ROUND((score_solution * 2)::numeric) / 2,
    COUNT(*)
  FROM responses
  WHERE case_id = p_case_id
    AND score_solution IS NOT NULL
  GROUP BY ROUND((score_solution * 2)::numeric) / 2;

  -- 主導の分布を計算
  INSERT INTO score_distribution (case_id, question, score_field, score_bucket, sample_count)
  SELECT
    p_case_id,
    p_question,
    'leadership',
    ROUND((score_leadership * 2)::numeric) / 2,
    COUNT(*)
  FROM responses
  WHERE case_id = p_case_id
    AND score_leadership IS NOT NULL
  GROUP BY ROUND((score_leadership * 2)::numeric) / 2;

  -- 連携の分布を計算
  INSERT INTO score_distribution (case_id, question, score_field, score_bucket, sample_count)
  SELECT
    p_case_id,
    p_question,
    'collaboration',
    ROUND((score_collaboration * 2)::numeric) / 2,
    COUNT(*)
  FROM responses
  WHERE case_id = p_case_id
    AND score_collaboration IS NOT NULL
  GROUP BY ROUND((score_collaboration * 2)::numeric) / 2;

  -- 育成の分布を計算
  INSERT INTO score_distribution (case_id, question, score_field, score_bucket, sample_count)
  SELECT
    p_case_id,
    p_question,
    'development',
    ROUND((score_development * 2)::numeric) / 2,
    COUNT(*)
  FROM responses
  WHERE case_id = p_case_id
    AND score_development IS NOT NULL
  GROUP BY ROUND((score_development * 2)::numeric) / 2;
END;
$$;

-- 全ケースのスコア分布を一括更新する関数
CREATE OR REPLACE FUNCTION update_all_score_distributions()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_case RECORD;
BEGIN
  FOR v_case IN SELECT DISTINCT case_id FROM cases
  LOOP
    PERFORM update_score_distribution(v_case.case_id, 'q1');
    PERFORM update_score_distribution(v_case.case_id, 'q2');
  END LOOP;
END;
$$;

-- スコア分布を取得する関数
CREATE OR REPLACE FUNCTION get_score_distribution(
  p_case_id TEXT,
  p_question TEXT,
  p_score_field TEXT
)
RETURNS TABLE (
  score_bucket NUMERIC,
  sample_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sd.score_bucket,
    sd.sample_count
  FROM score_distribution sd
  WHERE sd.case_id = p_case_id
    AND sd.question = p_question
    AND sd.score_field = p_score_field
  ORDER BY sd.score_bucket;
END;
$$;

-- ============================================
-- Prototypical Networks: スコアプロトタイプ
-- ============================================

-- スコアプロトタイプを保存するテーブル
CREATE TABLE IF NOT EXISTS score_prototypes (
  case_id TEXT NOT NULL,
  question TEXT NOT NULL,
  score_field TEXT NOT NULL,
  score_bucket NUMERIC NOT NULL,
  prototype_embedding vector(3072),
  sample_count INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP DEFAULT NOW(),
  PRIMARY KEY (case_id, question, score_field, score_bucket)
);

-- インデックスを作成
CREATE INDEX IF NOT EXISTS idx_score_prototypes_lookup
ON score_prototypes(case_id, question, score_field);

-- スコアプロトタイプを計算・更新する関数
CREATE OR REPLACE FUNCTION update_score_prototypes(
  p_case_id TEXT,
  p_question TEXT
)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- 既存のデータを削除
  DELETE FROM score_prototypes
  WHERE case_id = p_case_id AND question = p_question;

  -- 総合評点のプロトタイプを計算（各スコア帯のエンベディング平均）
  INSERT INTO score_prototypes (case_id, question, score_field, score_bucket, prototype_embedding, sample_count)
  SELECT
    p_case_id,
    p_question,
    'overall',
    ROUND((r.score_overall * 2)::numeric) / 2 as bucket,
    AVG(re.embedding)::vector(3072) as prototype,
    COUNT(*) as cnt
  FROM responses r
  JOIN response_embeddings re ON r.case_id = re.case_id AND r.response_id = re.response_id
  WHERE r.case_id = p_case_id
    AND re.question = p_question
    AND r.score_overall IS NOT NULL
    AND re.embedding IS NOT NULL
  GROUP BY ROUND((r.score_overall * 2)::numeric) / 2;

  -- 問題把握のプロトタイプを計算
  INSERT INTO score_prototypes (case_id, question, score_field, score_bucket, prototype_embedding, sample_count)
  SELECT
    p_case_id,
    p_question,
    'problem',
    ROUND((r.score_problem * 2)::numeric) / 2 as bucket,
    AVG(re.embedding)::vector(3072) as prototype,
    COUNT(*) as cnt
  FROM responses r
  JOIN response_embeddings re ON r.case_id = re.case_id AND r.response_id = re.response_id
  WHERE r.case_id = p_case_id
    AND re.question = p_question
    AND r.score_problem IS NOT NULL
    AND re.embedding IS NOT NULL
  GROUP BY ROUND((r.score_problem * 2)::numeric) / 2;

  -- 対策立案のプロトタイプを計算
  INSERT INTO score_prototypes (case_id, question, score_field, score_bucket, prototype_embedding, sample_count)
  SELECT
    p_case_id,
    p_question,
    'solution',
    ROUND((r.score_solution * 2)::numeric) / 2 as bucket,
    AVG(re.embedding)::vector(3072) as prototype,
    COUNT(*) as cnt
  FROM responses r
  JOIN response_embeddings re ON r.case_id = re.case_id AND r.response_id = re.response_id
  WHERE r.case_id = p_case_id
    AND re.question = p_question
    AND r.score_solution IS NOT NULL
    AND re.embedding IS NOT NULL
  GROUP BY ROUND((r.score_solution * 2)::numeric) / 2;

  -- 主導のプロトタイプを計算
  INSERT INTO score_prototypes (case_id, question, score_field, score_bucket, prototype_embedding, sample_count)
  SELECT
    p_case_id,
    p_question,
    'leadership',
    ROUND((r.score_leadership * 2)::numeric) / 2 as bucket,
    AVG(re.embedding)::vector(3072) as prototype,
    COUNT(*) as cnt
  FROM responses r
  JOIN response_embeddings re ON r.case_id = re.case_id AND r.response_id = re.response_id
  WHERE r.case_id = p_case_id
    AND re.question = p_question
    AND r.score_leadership IS NOT NULL
    AND re.embedding IS NOT NULL
  GROUP BY ROUND((r.score_leadership * 2)::numeric) / 2;

  -- 連携のプロトタイプを計算
  INSERT INTO score_prototypes (case_id, question, score_field, score_bucket, prototype_embedding, sample_count)
  SELECT
    p_case_id,
    p_question,
    'collaboration',
    ROUND((r.score_collaboration * 2)::numeric) / 2 as bucket,
    AVG(re.embedding)::vector(3072) as prototype,
    COUNT(*) as cnt
  FROM responses r
  JOIN response_embeddings re ON r.case_id = re.case_id AND r.response_id = re.response_id
  WHERE r.case_id = p_case_id
    AND re.question = p_question
    AND r.score_collaboration IS NOT NULL
    AND re.embedding IS NOT NULL
  GROUP BY ROUND((r.score_collaboration * 2)::numeric) / 2;

  -- 育成のプロトタイプを計算
  INSERT INTO score_prototypes (case_id, question, score_field, score_bucket, prototype_embedding, sample_count)
  SELECT
    p_case_id,
    p_question,
    'development',
    ROUND((r.score_development * 2)::numeric) / 2 as bucket,
    AVG(re.embedding)::vector(3072) as prototype,
    COUNT(*) as cnt
  FROM responses r
  JOIN response_embeddings re ON r.case_id = re.case_id AND r.response_id = re.response_id
  WHERE r.case_id = p_case_id
    AND re.question = p_question
    AND r.score_development IS NOT NULL
    AND re.embedding IS NOT NULL
  GROUP BY ROUND((r.score_development * 2)::numeric) / 2;
END;
$$;

-- 全ケースのスコアプロトタイプを一括更新する関数
CREATE OR REPLACE FUNCTION update_all_score_prototypes()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_case RECORD;
BEGIN
  FOR v_case IN SELECT DISTINCT case_id FROM cases
  LOOP
    PERFORM update_score_prototypes(v_case.case_id, 'q1');
    PERFORM update_score_prototypes(v_case.case_id, 'q2');
  END LOOP;
END;
$$;

-- プロトタイプとの類似度を計算してスコアを予測する関数
CREATE OR REPLACE FUNCTION predict_score_with_prototypes(
  p_embedding vector(3072),
  p_case_id TEXT,
  p_question TEXT,
  p_score_field TEXT
)
RETURNS TABLE (
  score_bucket NUMERIC,
  similarity DOUBLE PRECISION,
  sample_count INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    sp.score_bucket,
    (1 - (sp.prototype_embedding <=> p_embedding))::double precision as similarity,
    sp.sample_count
  FROM score_prototypes sp
  WHERE sp.case_id = p_case_id
    AND sp.question = p_question
    AND sp.score_field = p_score_field
    AND sp.prototype_embedding IS NOT NULL
  ORDER BY sp.prototype_embedding <=> p_embedding;
END;
$$;
