// 共通型定義

// ケース問題
export interface Case {
  case_id: string;
  case_name: string | null;
  situation_text: string | null;
}

// 解答データ
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
  // 問題把握の詳細評価データ
  detail_problem_maintenance_biz: number | null;
  detail_problem_maintenance_hr: number | null;
  detail_problem_reform_biz: number | null;
  detail_problem_reform_hr: number | null;
  detail_problem_understanding: number | null;
  detail_problem_essence: number | null;
  // 対策立案の詳細評価データ
  detail_solution_coverage: number | null;
  detail_solution_planning: number | null;
  detail_solution_maintenance_biz: number | null;
  detail_solution_maintenance_hr: number | null;
  detail_solution_reform_biz: number | null;
  detail_solution_reform_hr: number | null;
  // 連携の詳細評価データ
  detail_collab_supervisor: number | null;
  detail_collab_external: number | null;
  detail_collab_member: number | null;
  // 設問解答データ
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

// スコア入力用（主要スコア + 詳細スコア）
export interface Scores {
  // 主要スコア
  problem: number;           // 問題把握（0.5刻み、上限5）
  solution: number;          // 対策立案（0.5刻み、上限5）
  role: number;              // 役割理解（0.1刻み、上限5）
  leadership: number;        // 主導（0.5刻み、上限4）
  collaboration: number;     // 連携（0.5刻み、上限4）
  development: number;       // 育成（0.5刻み、上限4）
  // 問題把握の詳細スコア（1刻み、上限4）
  problemUnderstanding?: number;     // 状況理解
  problemEssence?: number;           // 本質把握
  problemMaintenanceBiz?: number;    // 維持管理・業務
  problemMaintenanceHr?: number;     // 維持管理・人
  problemReformBiz?: number;         // 改革・業務
  problemReformHr?: number;          // 改革・人
  // 対策立案の詳細スコア（1刻み、上限4）
  solutionCoverage?: number;         // 網羅性
  solutionPlanning?: number;         // 計画性
  solutionMaintenanceBiz?: number;   // 維持管理・業務
  solutionMaintenanceHr?: number;    // 維持管理・人
  solutionReformBiz?: number;        // 改革・業務
  solutionReformHr?: number;         // 改革・人
  // 連携の詳細スコア（1刻み、上限4）
  collabSupervisor?: number;         // 上司
  collabExternal?: number;           // 職場外
  collabMember?: number;             // メンバー
}

// 予測結果
export interface PredictionResponse {
  q1Answer: string;
  q1Reason?: string;
  q2Answer: string;
  q2Reason?: string;
  similarResponses?: Response[];
}

// 自由形式マネジメント相談の解答
export interface FreeQuestionResponse {
  answer: string;           // AIからの解答
  reasoning?: string;       // 解答の根拠・考え方
  suggestions?: string[];   // 追加の提案・アドバイス
}

// エゴグラム性格特徴（解答の文体に影響を与える）
export interface PersonalityTraits {
  cp: boolean;  // Critical Parent（批判的な親）: 厳格、規律的、断定的
  np: boolean;  // Nurturing Parent（養育的な親）: 思いやり、支援的、優しい
  a: boolean;   // Adult（大人）: 論理的、客観的、冷静
  fc: boolean;  // Free Child（自由な子供）: 自由奔放、創造的、感情的
  ac: boolean;  // Adapted Child（順応した子供）: 協調的、遠慮がち、控えめ
}

// 性格特徴のデフォルト値（すべてオフ）
export const defaultPersonalityTraits: PersonalityTraits = {
  cp: false,
  np: false,
  a: false,
  fc: false,
  ac: false,
};

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
  // 主要スコア
  problem: 2.5,
  solution: 2.5,
  role: 2.5,
  leadership: 2.5,
  collaboration: 2.5,
  development: 2.5,
  // 問題把握の詳細スコア
  problemUnderstanding: 2,
  problemEssence: 2,
  problemMaintenanceBiz: 2,
  problemMaintenanceHr: 2,
  problemReformBiz: 2,
  problemReformHr: 2,
  // 対策立案の詳細スコア
  solutionCoverage: 2,
  solutionPlanning: 2,
  solutionMaintenanceBiz: 2,
  solutionMaintenanceHr: 2,
  solutionReformBiz: 2,
  solutionReformHr: 2,
  // 連携の詳細スコア
  collabSupervisor: 2,
  collabExternal: 2,
  collabMember: 2,
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
  // 問題把握の詳細評価データ
  detail_problem_maintenance_biz?: number;
  detail_problem_maintenance_hr?: number;
  detail_problem_reform_biz?: number;
  detail_problem_reform_hr?: number;
  detail_problem_understanding?: number;
  detail_problem_essence?: number;
  // 対策立案の詳細評価データ
  detail_solution_coverage?: number;
  detail_solution_planning?: number;
  detail_solution_maintenance_biz?: number;
  detail_solution_maintenance_hr?: number;
  detail_solution_reform_biz?: number;
  detail_solution_reform_hr?: number;
  // 連携の詳細評価データ
  detail_collab_supervisor?: number;
  detail_collab_external?: number;
  detail_collab_member?: number;
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
