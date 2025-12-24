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
          created_at: string;
          updated_at: string;
        };
        Insert: {
          case_id: string;
          case_name?: string | null;
          situation_text?: string | null;
        };
        Update: {
          case_id?: string;
          case_name?: string | null;
          situation_text?: string | null;
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
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// 管理者ユーザー型
export type AdminUser = Database['public']['Tables']['admin_users']['Row'];
