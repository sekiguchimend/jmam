import type { CaseAssignmentRow, UserToCasesMap } from "./types";

export const MAX_ASSIGNMENTS = 5;

export function buildUserToCasesMap(assignments: CaseAssignmentRow[]): UserToCasesMap {
  const map: UserToCasesMap = {};
  for (const row of assignments) {
    const u = String(row.user_id ?? "").trim();
    const c = String(row.case_id ?? "").trim();
    if (!u || !c) continue;
    if (!map[u]) map[u] = [];
    if (!map[u].includes(c)) map[u].push(c);
  }
  return map;
}

export function invertUserToCasesMap(userToCases: UserToCasesMap): Record<string, string[]> {
  const map: Record<string, string[]> = {};
  for (const [userId, caseIds] of Object.entries(userToCases)) {
    for (const caseId of caseIds) {
      if (!map[caseId]) map[caseId] = [];
      map[caseId].push(userId);
    }
  }
  return map;
}

export function safeLower(s: string | null | undefined): string {
  return (s ?? "").toLowerCase();
}

export function displayUserName(user: { name: string | null; email: string | null }): string {
  if (user.name && user.name.trim()) return user.name;
  if (user.email && user.email.includes("@")) return user.email.split("@")[0];
  return user.email ?? "ユーザー";
}


