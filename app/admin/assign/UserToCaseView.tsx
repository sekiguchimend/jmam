"use client";

import { useMemo, useState } from "react";
import { Users, Search, Check } from "lucide-react";
import { Button } from "@/components/ui";
import type { AssignCase, AssignUser, UserToCasesMap } from "./types";
import { displayUserName, MAX_ASSIGNMENTS, safeLower } from "./utils";

export function UserToCaseView(props: {
  users: AssignUser[];
  cases: AssignCase[];
  userToCases: UserToCasesMap;
  onUpdateUserCases: (userId: string, nextCaseIds: string[]) => void;
  onSaveUserCases: (userId: string, caseIds: string[]) => Promise<void>;
  onSelectionChange: (hasSelection: boolean) => void;
  isLocked: boolean;
  isSaving: boolean;
}) {
  const { users, cases, userToCases, onUpdateUserCases, onSaveUserCases, onSelectionChange, isLocked, isSaving } = props;
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredUsers = useMemo(() => {
    const q = safeLower(searchQuery.trim());
    if (!q) return users;
    return users.filter((u) => safeLower(u.name).includes(q) || safeLower(u.email).includes(q));
  }, [searchQuery, users]);

  const selectedUser = users.find((u) => u.id === selectedUserId) ?? null;
  const currentCaseIds = selectedUserId ? userToCases[selectedUserId] ?? [] : [];
  const currentAssignCount = currentCaseIds.length;

  const handleSelectUser = (userId: string) => {
    if (isLocked) return;
    setSelectedUserId(userId);
    onSelectionChange(true);
  };

  const handleClear = () => {
    setSelectedUserId(null);
    onSelectionChange(false);
  };

  const toggleCase = (caseId: string) => {
    if (!selectedUserId) return;
    const current = userToCases[selectedUserId] ?? [];
    const isAssigned = current.includes(caseId);
    if (isAssigned) {
      onUpdateUserCases(selectedUserId, current.filter((id) => id !== caseId));
      return;
    }
    if (current.length >= MAX_ASSIGNMENTS) return;
    onUpdateUserCases(selectedUserId, [...current, caseId]);
  };

  const handleSave = async () => {
    if (!selectedUserId) return;
    await onSaveUserCases(selectedUserId, currentCaseIds);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* ユーザーリスト - 左側コンパクト */}
      <div
        className="lg:col-span-2 rounded-xl p-5 lg:p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* 検索 */}
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg mb-4"
          style={{ background: "var(--background)", border: "1px solid var(--border)" }}
        >
          <Search className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ユーザーを検索..."
            className="w-full bg-transparent text-sm font-bold outline-none"
            style={{ color: "#323232" }}
          />
        </div>

        {/* ユーザーリスト - コンパクト表示 */}
        <div className="space-y-0.5 max-h-96 overflow-y-auto">
          {filteredUsers.map((user) => {
            const isSelected = selectedUserId === user.id;
            const assignCount = userToCases[user.id]?.length || 0;
            return (
              <button
                key={user.id}
                onClick={() => handleSelectUser(user.id)}
                disabled={isLocked}
                className="w-full flex items-center gap-3 p-2.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* アバター */}
                <div
                  className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                  style={{
                    background: "var(--primary-light)",
                    color: "var(--primary)",
                  }}
                >
                  {displayUserName(user).charAt(0)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span
                    className="font-black text-sm truncate inline-block pb-0.5"
                    style={{
                      color: isSelected ? "var(--primary)" : "#323232",
                      borderBottom: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                    }}
                  >
                    {displayUserName(user)}
                  </span>
                  <p className="text-xs font-bold truncate" style={{ color: "var(--text-muted)" }}>
                    {user.email ?? "-"}
                  </p>
                </div>
                {/* バッジ */}
                {assignCount > 0 && (
                  <span
                    className="px-2 py-0.5 rounded-full text-xs font-black"
                    style={{
                      background: "var(--success-light)",
                      color: "var(--success)",
                    }}
                  >
                    {assignCount}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ケース割り当て - 右側メイン */}
      <div
        className="lg:col-span-3 rounded-xl p-5 lg:p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {selectedUser ? (
          <>
            {/* 選択中ユーザー表示 */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {displayUserName(selectedUser).charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-black text-lg" style={{ color: "#323232" }}>
                  {displayUserName(selectedUser)}
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                  {selectedUser.email ?? "-"}
                </p>
              </div>
              <button
                onClick={handleClear}
                className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all duration-200"
                style={{ background: "var(--background)", color: "var(--text-muted)" }}
              >
                解除
              </button>
            </div>

            {/* 上限表示 */}
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                ケースを選択
              </p>
              <p
                className="text-sm font-black"
                style={{ color: currentAssignCount >= MAX_ASSIGNMENTS ? "var(--error)" : "var(--primary)" }}
              >
                {currentAssignCount} / {MAX_ASSIGNMENTS}
              </p>
            </div>

            {/* ケースリスト */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {cases.map((caseItem) => {
                const isAssigned = currentCaseIds.includes(caseItem.id);
                const isDisabled = !isAssigned && currentAssignCount >= MAX_ASSIGNMENTS;
                return (
                  <button
                    key={caseItem.id}
                    onClick={() => toggleCase(caseItem.id)}
                    disabled={isDisabled}
                    className="w-full flex items-center gap-3 p-3 rounded-lg transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: isAssigned ? "var(--primary)" : "var(--background)",
                    }}
                  >
                    <div
                      className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
                      style={{
                        background: isAssigned ? "rgba(255,255,255,0.3)" : "var(--border)",
                      }}
                    >
                      {isAssigned && <Check className="w-3.5 h-3.5" style={{ color: "#fff" }} />}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p className="font-black text-sm truncate" style={{ color: isAssigned ? "#fff" : "#323232" }}>
                        {caseItem.name || caseItem.id}
                      </p>
                      <p
                        className="text-xs font-bold"
                        style={{ color: isAssigned ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                      >
                        {caseItem.id}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 保存ボタン */}
            <div className="mt-6 pt-4 border-t flex justify-end" style={{ borderColor: "var(--border)" }}>
              <Button onClick={handleSave} disabled={isSaving}>
                保存
              </Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: "var(--background)" }}
            >
              <Users className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="font-black text-lg mb-1" style={{ color: "#323232" }}>
              ユーザーを選択
            </p>
            <p className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>
              左のリストからユーザーを選んでください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}


