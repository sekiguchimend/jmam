// Supabase データベース型定義
// 非機能要件に基づくスキーマ型定義

export type Database = {
  public: {
    Tables: {
      case_assignments: {
        Row: {
          user_id: string;
          case_id: string;
          created_at: string;
        };
        Insert: {
          user_id: string;
          case_id: string;
          created_at?: string;
        };
        Update: {
          user_id?: string;
          case_id?: string;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "case_assignments_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "cases";
            referencedColumns: ["case_id"];
          },
          {
            foreignKeyName: "case_assignments_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          }
        ];
      };
      cases: {
        Row: {
          case_id: string;
          case_name: string | null;
          situation_text: string | null;
          situation_embedding: number[] | null;
          embedding_model: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          case_name?: string | null;
          situation_text?: string | null;
          situation_embedding?: number[] | null;
          embedding_model?: string | null;
        };
        Update: {
          case_id?: string;
          case_name?: string | null;
          situation_text?: string | null;
          situation_embedding?: number[] | null;
          embedding_model?: string | null;
        };
        Relationships: [];
      };
      responses: {
        Row: {
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
          // タイムスタンプ
          created_at: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          response_id: string;
          submitted_at?: string | null;
          score_overall?: number | null;
          score_problem?: number | null;
          score_solution?: number | null;
          score_role?: number | null;
          score_leadership?: number | null;
          score_collaboration?: number | null;
          score_development?: number | null;
          comment_overall?: string | null;
          comment_problem?: string | null;
          comment_solution?: string | null;
          detail_problem_maintenance_biz?: number | null;
          detail_problem_maintenance_hr?: number | null;
          detail_problem_reform_biz?: number | null;
          detail_problem_reform_hr?: number | null;
          detail_problem_understanding?: number | null;
          detail_problem_essence?: number | null;
          // 対策立案の詳細評価データ
          detail_solution_coverage?: number | null;
          detail_solution_planning?: number | null;
          detail_solution_maintenance_biz?: number | null;
          detail_solution_maintenance_hr?: number | null;
          detail_solution_reform_biz?: number | null;
          detail_solution_reform_hr?: number | null;
          // 連携の詳細評価データ
          detail_collab_supervisor?: number | null;
          detail_collab_external?: number | null;
          detail_collab_member?: number | null;
          answer_q1?: string | null;
          answer_q2?: string | null;
          answer_q3?: string | null;
          answer_q4?: string | null;
          answer_q5?: string | null;
          answer_q6?: string | null;
          answer_q7?: string | null;
          answer_q8?: string | null;
          answer_q9?: string | null;
        };
        Update: {
          case_id?: string;
          response_id?: string;
          submitted_at?: string | null;
          score_overall?: number | null;
          score_problem?: number | null;
          score_solution?: number | null;
          score_role?: number | null;
          score_leadership?: number | null;
          score_collaboration?: number | null;
          score_development?: number | null;
          comment_overall?: string | null;
          comment_problem?: string | null;
          comment_solution?: string | null;
          detail_problem_maintenance_biz?: number | null;
          detail_problem_maintenance_hr?: number | null;
          detail_problem_reform_biz?: number | null;
          detail_problem_reform_hr?: number | null;
          detail_problem_understanding?: number | null;
          detail_problem_essence?: number | null;
          // 対策立案の詳細評価データ
          detail_solution_coverage?: number | null;
          detail_solution_planning?: number | null;
          detail_solution_maintenance_biz?: number | null;
          detail_solution_maintenance_hr?: number | null;
          detail_solution_reform_biz?: number | null;
          detail_solution_reform_hr?: number | null;
          // 連携の詳細評価データ
          detail_collab_supervisor?: number | null;
          detail_collab_external?: number | null;
          detail_collab_member?: number | null;
          answer_q1?: string | null;
          answer_q2?: string | null;
          answer_q3?: string | null;
          answer_q4?: string | null;
          answer_q5?: string | null;
          answer_q6?: string | null;
          answer_q7?: string | null;
          answer_q8?: string | null;
          answer_q9?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "responses_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "cases";
            referencedColumns: ["case_id"];
          }
        ];
      };
      admin_users: {
        Row: {
          id: string;
          email: string;
          name: string | null;
          role: 'admin' | 'super_admin';
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          name?: string | null;
          role?: 'admin' | 'super_admin';
          is_active?: boolean;
        };
        Update: {
          email?: string;
          name?: string | null;
          role?: 'admin' | 'super_admin';
          is_active?: boolean;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          name: string | null;
          status: 'active' | 'suspended' | 'deleted';
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          name?: string | null;
          status?: 'active' | 'suspended' | 'deleted';
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          name?: string | null;
          status?: 'active' | 'suspended' | 'deleted';
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profiles_id_fkey";
            columns: ["id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_blocks: {
        Row: {
          user_id: string;
          email: string | null;
          reason: string | null;
          blocked_at: string;
        };
        Insert: {
          user_id: string;
          email?: string | null;
          reason?: string | null;
          blocked_at?: string;
        };
        Update: {
          user_id?: string;
          email?: string | null;
          reason?: string | null;
          blocked_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_blocks_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          }
        ];
      };
      user_score_records: {
        Row: {
          id: string;
          user_id: string;
          case_id: string;
          score_problem: number;
          score_solution: number;
          score_role: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          case_id: string;
          score_problem: number;
          score_solution: number;
          score_role: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          case_id?: string;
          score_problem?: number;
          score_solution?: number;
          score_role?: number;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_score_records_user_id_fkey";
            columns: ["user_id"];
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_score_records_case_id_fkey";
            columns: ["case_id"];
            referencedRelation: "cases";
            referencedColumns: ["case_id"];
          }
        ];
      };
      embedding_queue: {
        Row: {
          case_id: string;
          response_id: string;
          question: 'q1' | 'q2';
          status: 'pending' | 'processing' | 'done' | 'error';
          attempts: number;
          last_error: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          response_id: string;
          question: 'q1' | 'q2';
          status?: 'pending' | 'processing' | 'done' | 'error';
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          response_id?: string;
          question?: 'q1' | 'q2';
          status?: 'pending' | 'processing' | 'done' | 'error';
          attempts?: number;
          last_error?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'embedding_queue_response_fkey';
            columns: ['case_id', 'response_id'];
            referencedRelation: 'responses';
            referencedColumns: ['case_id', 'response_id'];
          }
        ];
      };
      response_embeddings: {
        Row: {
          case_id: string;
          response_id: string;
          question: 'q1' | 'q2';
          score: number | null;
          score_bucket: number;
          embedding: unknown;
          embedding_model: string;
          embedding_dim: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          response_id: string;
          question: 'q1' | 'q2';
          score?: number | null;
          score_bucket: number;
          embedding: unknown;
          embedding_model?: string;
          embedding_dim?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          case_id?: string;
          response_id?: string;
          question?: 'q1' | 'q2';
          score?: number | null;
          score_bucket?: number;
          embedding?: unknown;
          embedding_model?: string;
          embedding_dim?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'response_embeddings_response_fkey';
            columns: ['case_id', 'response_id'];
            referencedRelation: 'responses';
            referencedColumns: ['case_id', 'response_id'];
          }
        ];
      };
      typical_examples: {
        Row: {
          id: string;
          case_id: string;
          question: 'q1' | 'q2';
          score_bucket: number;
          cluster_id: number;
          cluster_size: number;
          centroid: unknown;
          rep_case_id: string;
          rep_response_id: string;
          rep_text: string;
          rep_score: number | null;
          rep_distance: number | null;
          embedding_model: string;
          embedding_dim: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          question: 'q1' | 'q2';
          score_bucket: number;
          cluster_id: number;
          cluster_size: number;
          centroid: unknown;
          rep_case_id: string;
          rep_response_id: string;
          rep_text: string;
          rep_score?: number | null;
          rep_distance?: number | null;
          embedding_model?: string;
          embedding_dim?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          case_id?: string;
          question?: 'q1' | 'q2';
          score_bucket?: number;
          cluster_id?: number;
          cluster_size?: number;
          centroid?: unknown;
          rep_case_id?: string;
          rep_response_id?: string;
          rep_text?: string;
          rep_score?: number | null;
          rep_distance?: number | null;
          embedding_model?: string;
          embedding_dim?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'typical_examples_case_id_fkey';
            columns: ['case_id'];
            referencedRelation: 'cases';
            referencedColumns: ['case_id'];
          },
          {
            foreignKeyName: 'typical_examples_rep_response_fkey';
            columns: ['rep_case_id', 'rep_response_id'];
            referencedRelation: 'responses';
            referencedColumns: ['case_id', 'response_id'];
          }
        ];
      };

      questions: {
        Row: {
          id: string;
          case_id: string;
          question_key: 'q1' | 'q2';
          question_text: string;
          question_embedding: number[] | null;
          embedding_model: string | null;
          order_index: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          case_id: string;
          question_key: 'q1' | 'q2';
          question_text: string;
          question_embedding?: number[] | null;
          embedding_model?: string | null;
          order_index?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          question_text?: string;
          question_embedding?: number[] | null;
          embedding_model?: string | null;
          order_index?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: 'questions_case_id_fkey';
            columns: ['case_id'];
            referencedRelation: 'cases';
            referencedColumns: ['case_id'];
          }
        ];
      };
    };
    Views: Record<string, never>;
    Functions: {
      admin_restore_profile_by_email: {
        Args: {
          p_email: string;
          p_name: string | null;
        };
        Returns: string | null;
      };
      find_similar_responses_for_scoring: {
        Args: {
          p_embedding: string;
          p_case_id: string;
          p_question: string;
          p_limit?: number;
        };
        Returns: Array<{
          response_id: string;
          similarity: number;
          answer_text: string;
          // 主要スコア
          score_overall: number | null;
          score_problem: number | null;
          score_solution: number | null;
          score_role: number | null;
          score_leadership: number | null;
          score_collaboration: number | null;
          score_development: number | null;
          // 問題把握の詳細スコア
          detail_problem_understanding: number | null;
          detail_problem_essence: number | null;
          detail_problem_maintenance_biz: number | null;
          detail_problem_maintenance_hr: number | null;
          detail_problem_reform_biz: number | null;
          detail_problem_reform_hr: number | null;
          // 対策立案の詳細スコア
          detail_solution_coverage: number | null;
          detail_solution_planning: number | null;
          detail_solution_maintenance_biz: number | null;
          detail_solution_maintenance_hr: number | null;
          detail_solution_reform_biz: number | null;
          detail_solution_reform_hr: number | null;
          // 連携の詳細スコア
          detail_collab_supervisor: number | null;
          detail_collab_external: number | null;
          detail_collab_member: number | null;
          // コメント
          comment_problem: string | null;
          comment_solution: string | null;
          comment_overall: string | null;
        }>;
      };
      find_similar_cases: {
        Args: {
          p_embedding: string;
          p_limit?: number;
        };
        Returns: Array<{
          case_id: string;
          case_name: string | null;
          situation_text: string | null;
          similarity: number;
        }>;
      };
      find_similar_responses_cross_cases: {
        Args: {
          p_embedding: string;
          p_case_ids: string[];
          p_question: string;
          p_limit?: number;
        };
        Returns: Array<{
          response_id: string;
          case_id: string;
          case_name: string | null;
          similarity: number;
          answer_text: string;
          // 主要スコア
          score_overall: number | null;
          score_problem: number | null;
          score_solution: number | null;
          score_role: number | null;
          score_leadership: number | null;
          score_collaboration: number | null;
          score_development: number | null;
          // 問題把握の詳細スコア
          detail_problem_understanding: number | null;
          detail_problem_essence: number | null;
          detail_problem_maintenance_biz: number | null;
          detail_problem_maintenance_hr: number | null;
          detail_problem_reform_biz: number | null;
          detail_problem_reform_hr: number | null;
          // 対策立案の詳細スコア
          detail_solution_coverage: number | null;
          detail_solution_planning: number | null;
          detail_solution_maintenance_biz: number | null;
          detail_solution_maintenance_hr: number | null;
          detail_solution_reform_biz: number | null;
          detail_solution_reform_hr: number | null;
          // 連携の詳細スコア
          detail_collab_supervisor: number | null;
          detail_collab_external: number | null;
          detail_collab_member: number | null;
          // コメント
          comment_problem: string | null;
          comment_solution: string | null;
          comment_overall: string | null;
        }>;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// 管理者ユーザー型
export type AdminUser = Database['public']['Tables']['admin_users']['Row'];

// 設問型
export type QuestionRow = Database['public']['Tables']['questions']['Row'];
export type QuestionInsert = Database['public']['Tables']['questions']['Insert'];
export type QuestionUpdate = Database['public']['Tables']['questions']['Update'];
