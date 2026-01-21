-- Update find_similar_responses_cross_cases function to include all score fields
-- This function returns similar responses across multiple cases with all score details

CREATE OR REPLACE FUNCTION find_similar_responses_cross_cases(
  p_embedding text,
  p_case_ids text[],
  p_question text,
  p_limit integer DEFAULT 50
)
RETURNS TABLE (
  response_id text,
  case_id text,
  case_name text,
  similarity double precision,
  answer_text text,
  -- Main scores
  score_overall double precision,
  score_problem double precision,
  score_solution double precision,
  score_role double precision,
  score_leadership double precision,
  score_collaboration double precision,
  score_development double precision,
  -- Problem detail scores
  detail_problem_understanding integer,
  detail_problem_essence integer,
  detail_problem_maintenance_biz integer,
  detail_problem_maintenance_hr integer,
  detail_problem_reform_biz integer,
  detail_problem_reform_hr integer,
  -- Solution detail scores
  detail_solution_coverage integer,
  detail_solution_planning integer,
  detail_solution_maintenance_biz integer,
  detail_solution_maintenance_hr integer,
  detail_solution_reform_biz integer,
  detail_solution_reform_hr integer,
  -- Collaboration detail scores
  detail_collab_supervisor integer,
  detail_collab_external integer,
  detail_collab_member integer,
  -- Comments
  comment_problem text,
  comment_solution text,
  comment_overall text
)
LANGUAGE plpgsql
AS $$
DECLARE
  embedding_array double precision[];
  answer_column text;
BEGIN
  -- Parse embedding from JSON string to array
  embedding_array := ARRAY(SELECT json_array_elements_text(p_embedding::json)::double precision);

  -- Determine which answer column to use based on question
  answer_column := 'answer_' || p_question;

  -- Return similar responses with cosine similarity
  RETURN QUERY
  EXECUTE format('
    SELECT
      r.response_id,
      r.case_id,
      c.case_name,
      1 - (re.embedding <=> $1) AS similarity,
      r.%I AS answer_text,
      r.score_overall,
      r.score_problem,
      r.score_solution,
      r.score_role,
      r.score_leadership,
      r.score_collaboration,
      r.score_development,
      r.detail_problem_understanding,
      r.detail_problem_essence,
      r.detail_problem_maintenance_biz,
      r.detail_problem_maintenance_hr,
      r.detail_problem_reform_biz,
      r.detail_problem_reform_hr,
      r.detail_solution_coverage,
      r.detail_solution_planning,
      r.detail_solution_maintenance_biz,
      r.detail_solution_maintenance_hr,
      r.detail_solution_reform_biz,
      r.detail_solution_reform_hr,
      r.detail_collab_supervisor,
      r.detail_collab_external,
      r.detail_collab_member,
      r.comment_problem,
      r.comment_solution,
      r.comment_overall
    FROM responses r
    JOIN response_embeddings re ON r.id = re.response_id AND re.question = $2
    JOIN cases c ON r.case_id = c.case_id
    WHERE r.case_id = ANY($3)
      AND r.%I IS NOT NULL
      AND r.%I != ''''
    ORDER BY re.embedding <=> $1
    LIMIT $4
  ', answer_column, answer_column, answer_column)
  USING embedding_array, p_question, p_case_ids, p_limit;
END;
$$;
