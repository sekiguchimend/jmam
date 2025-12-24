"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { Users, FileQuestion, Lock } from "lucide-react";
import type { ActiveSelection, Tab, AssignCase, AssignUser, CaseAssignmentRow, UserToCasesMap } from "./types";
import { buildUserToCasesMap, invertUserToCasesMap } from "./utils";
import { UserToCaseView } from "./UserToCaseView";
import { CaseToUserView } from "./CaseToUserView";
import { adminSaveCaseAssignments, adminSaveUserAssignments } from "@/actions/assign";

export function AssignClient(props: {
  initial: { users: AssignUser[]; cases: AssignCase[]; assignments: CaseAssignmentRow[] } | null;
  loadError: string | null;
}) {
  const [activeTab, setActiveTab] = useState<Tab>("user-to-case");
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<{ [key in Tab]?: HTMLButtonElement | null }>({});
  const [activeSelection, setActiveSelection] = useState<ActiveSelection>(null);
  const [savePending, startSave] = useTransition();

  const users = props.initial?.users ?? [];
  const cases = props.initial?.cases ?? [];
  const [userToCases, setUserToCases] = useState<UserToCasesMap>(() =>
    buildUserToCasesMap(props.initial?.assignments ?? [])
  );

  const caseToUsers = useMemo(() => invertUserToCasesMap(userToCases), [userToCases]);

  // タブインジケーターの位置を更新
  useEffect(() => {
    const activeTabEl = tabRefs.current[activeTab];
    if (activeTabEl) {
      setIndicatorStyle({
        left: activeTabEl.offsetLeft,
        width: activeTabEl.offsetWidth,
      });
    }
  }, [activeTab]);

  const tabs: { key: Tab; label: string; icon: React.ReactNode; lockedBy: ActiveSelection }[] = [
    { key: "user-to-case", label: "ユーザー → ケース", icon: <Users className="w-4 h-4" />, lockedBy: "case" },
    { key: "case-to-user", label: "ケース → ユーザー", icon: <FileQuestion className="w-4 h-4" />, lockedBy: "user" },
  ];

  const handleTabClick = (tabKey: Tab, lockedBy: ActiveSelection) => {
    if (activeSelection === lockedBy) return;
    setActiveTab(tabKey);
  };

  const updateUserCases = (userId: string, nextCaseIds: string[]) => {
    setUserToCases((prev) => ({ ...prev, [userId]: nextCaseIds }));
  };

  const updateCaseUsers = (caseId: string, nextUserIds: string[]) => {
    // case->users を user->cases に反映
    setUserToCases((prev) => {
      const next: UserToCasesMap = { ...prev };
      const nextUserSet = new Set(nextUserIds);

      // まずこのcaseIdを全ユーザーから外す（影響範囲だけ）
      for (const [u, caseIds] of Object.entries(next)) {
        if (!caseIds?.includes(caseId)) continue;
        const filtered = caseIds.filter((c) => c !== caseId);
        next[u] = filtered;
      }

      // 次に指定ユーザーへ付与
      for (const u of nextUserSet) {
        const current = next[u] ?? [];
        if (!current.includes(caseId)) next[u] = [...current, caseId];
      }
      return next;
    });
  };

  const saveUserCases = async (userId: string, caseIds: string[]) => {
    startSave(async () => {
      const res = await adminSaveUserAssignments({ userId, caseIds });
      if (!res.success) {
        alert(res.error);
        return;
      }
      alert("保存しました");
    });
  };

  const saveCaseUsers = async (caseId: string, userIds: string[]) => {
    startSave(async () => {
      const res = await adminSaveCaseAssignments({ caseId, userIds });
      if (!res.success) {
        alert(res.error);
        return;
      }
      alert("保存しました");
    });
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* ヘッダー */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
          スコア割り当て
        </h1>
        <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
          ユーザーとケースの紐付けを管理
        </p>
      </div>

      {props.loadError && (
        <div
          className="rounded-xl p-4 border text-sm font-black mb-6"
          style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--error)" }}
        >
          {props.loadError}
        </div>
      )}

      {/* タブ切り替え */}
      <div
        className="relative inline-flex p-1 rounded-xl mb-6"
        style={{ background: "var(--border)" }}
      >
        {/* スライドインジケーター */}
        <div
          className="absolute top-1 bottom-1 rounded-lg transition-all duration-300 ease-out"
          style={{
            left: indicatorStyle.left,
            width: indicatorStyle.width,
            background: "var(--surface)",
            boxShadow: "var(--shadow)",
          }}
        />

        {/* タブボタン */}
        {tabs.map((tab) => {
          const isLocked = activeSelection === tab.lockedBy;
          return (
            <button
              key={tab.key}
              ref={(el) => { tabRefs.current[tab.key] = el; }}
              onClick={() => handleTabClick(tab.key, tab.lockedBy)}
              disabled={isLocked}
              className={`
                relative z-10 flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-black
                transition-colors duration-200 disabled:cursor-not-allowed
              `}
              style={{
                color: isLocked ? "var(--text-muted)" : activeTab === tab.key ? "var(--primary)" : "var(--text-muted)",
                opacity: isLocked ? 0.5 : 1,
              }}
            >
              {isLocked ? <Lock className="w-4 h-4" /> : tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* コンテンツ */}
      <div className="relative overflow-hidden">
        <div
          className="flex transition-transform duration-300 ease-out"
          style={{
            transform: activeTab === "user-to-case" ? "translateX(0)" : "translateX(-50%)",
            width: "200%",
          }}
        >
          {/* ユーザー → ケース */}
          <div className="w-1/2 pr-4">
            <UserToCaseView
              users={users}
              cases={cases}
              userToCases={userToCases}
              onUpdateUserCases={updateUserCases}
              onSaveUserCases={saveUserCases}
              onSelectionChange={(hasSelection) => setActiveSelection(hasSelection ? "user" : null)}
              isLocked={activeSelection === "case"}
              isSaving={savePending}
            />
          </div>

          {/* ケース → ユーザー */}
          <div className="w-1/2 pl-4">
            <CaseToUserView
              users={users}
              cases={cases}
              caseToUsers={caseToUsers}
              onUpdateCaseUsers={updateCaseUsers}
              onSaveCaseUsers={saveCaseUsers}
              onSelectionChange={(hasSelection) => setActiveSelection(hasSelection ? "case" : null)}
              isLocked={activeSelection === "user"}
              isSaving={savePending}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
