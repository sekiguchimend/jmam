// 共通型定義

// ケース問題
export interface Case {
  case_id: string;
  case_name: string | null;
  situation_text: string | null;
}

// 回答データ
export interface Response {
  id: string;
  case_id: string;
  response_id: string;
  submitted_at: string | null;
  // 評点データ
  score_overall: number | null;
  score_problem: number | null;
  score_solution: number | null;
  score_role: number | null;
  score_leadership: number | null;
  score_collaboration: number | null;
  score_development: number | null;
  // コメントデータ
  comment_overall: string | null;
  comment_problem: string | null;
  comment_solution: string | null;
  // 詳細評価データ
  detail_problem_maintenance_biz: number | null;
  detail_problem_maintenance_hr: number | null;
  detail_problem_reform_biz: number | null;
  detail_problem_reform_hr: number | null;
  detail_problem_understanding: number | null;
  detail_problem_essence: number | null;
  // 設問回答データ
  answer_q1: string | null;
  answer_q2: string | null;
  answer_q3: string | null;
  answer_q4: string | null;
  answer_q5: string | null;
  answer_q6: string | null;
  answer_q7: string | null;
  answer_q8: string | null;
  answer_q9: string | null;
}

// スコア入力用
export interface Scores {
  problem: number;
  solution: number;
  role: number;
  leadership: number;
  collaboration: number;
  development: number;
}

// 予測結果
export interface PredictionResponse {
  q1Answer: string;
  q1Reason?: string;
  q2Answer: string;
  q2Reason?: string;
  similarResponses?: Response[];
}

export type TypicalExample = {
  case_id: string;
  question: 'q1' | 'q2';
  score_bucket: number;
  cluster_id: number;
  cluster_size: number;
  rep_text: string;
  rep_score: number | null;
};

// 設問型
export interface Question {
  id: string;
  case_id: string;
  question_key: 'q1' | 'q2';
  question_text: string;
  question_embedding: number[] | null;
  order_index: number;
}

// アップロード進捗
export interface UploadProgress {
  fileName: string;
  total: number;
  processed: number;
  errors: string[];
  status: 'idle' | 'processing' | 'completed' | 'error';
}

// データセット統計（FR-12用）
export interface DatasetStats {
  caseId: string;
  caseName: string | null;
  recordCount: number;
}

// データセット型（レガシー互換用）
export interface Dataset {
  id: string;
  fileName: string;
  uploadedAt: string;
  recordCount: number;
}

// 初期スコア値
export const defaultScores: Scores = {
  problem: 2.5,
  solution: 2.5,
  role: 2.5,
  leadership: 2.5,
  collaboration: 2.5,
  development: 2.5,
};

// CSVアップロード用の行データ型
export interface CsvRowData {
  response_id: string;
  case_id: string;
  case_name?: string;
  submitted_at?: string;
  score_overall?: number;
  score_problem?: number;
  score_solution?: number;
  score_role?: number;
  score_leadership?: number;
  score_collaboration?: number;
  score_development?: number;
  comment_overall?: string;
  comment_problem?: string;
  comment_solution?: string;
  detail_problem_maintenance_biz?: number;
  detail_problem_maintenance_hr?: number;
  detail_problem_reform_biz?: number;
  detail_problem_reform_hr?: number;
  detail_problem_understanding?: number;
  detail_problem_essence?: number;
  answer_q1?: string;
  answer_q2?: string;
  answer_q3?: string;
  answer_q4?: string;
  answer_q5?: string;
  answer_q6?: string;
  answer_q7?: string;
  answer_q8?: string;
  answer_q9?: string;
}
