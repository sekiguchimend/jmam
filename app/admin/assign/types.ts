export type Tab = "user-to-case" | "case-to-user";
export type ActiveSelection = "user" | "case" | null;

export type AssignUser = {
  id: string;
  name: string | null;
  email: string | null;
};

export type AssignCase = {
  id: string;
  name: string | null;
};

export type CaseAssignmentRow = {
  user_id: string;
  case_id: string;
};

export type UserToCasesMap = Record<string, string[]>;


