"use client";

import { useState, useRef, useEffect } from "react";
import { Users, FileQuestion, Search, Check, Lock } from "lucide-react";
import { Button } from "@/components/ui";

type Tab = "user-to-case" | "case-to-user";
type ActiveSelection = "user" | "case" | null;

const MAX_ASSIGNMENTS = 5;

// ダミーデータ（実際はAPIから取得）
const dummyUsers = [
  { id: "1", name: "山田太郎", email: "yamada@example.com" },
  { id: "2", name: "佐藤花子", email: "sato@example.com" },
  { id: "3", name: "鈴木一郎", email: "suzuki@example.com" },
  { id: "4", name: "田中美咲", email: "tanaka@example.com" },
  { id: "5", name: "高橋健太", email: "takahashi@example.com" },
];

const dummyCases = [
  { id: "case-001", name: "新規事業立ち上げケース" },
  { id: "case-002", name: "組織改革シナリオ" },
  { id: "case-003", name: "人材育成プラン策定" },
  { id: "case-004", name: "業績改善プロジェクト" },
];

export function AssignClient() {
  const [activeTab, setActiveTab] = useState<Tab>("user-to-case");
  const [indicatorStyle, setIndicatorStyle] = useState({ left: 0, width: 0 });
  const tabRefs = useRef<{ [key in Tab]?: HTMLButtonElement | null }>({});
  const [activeSelection, setActiveSelection] = useState<ActiveSelection>(null);

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
              users={dummyUsers}
              cases={dummyCases}
              onSelectionChange={(hasSelection) => setActiveSelection(hasSelection ? "user" : null)}
              isLocked={activeSelection === "case"}
            />
          </div>

          {/* ケース → ユーザー */}
          <div className="w-1/2 pl-4">
            <CaseToUserView
              users={dummyUsers}
              cases={dummyCases}
              onSelectionChange={(hasSelection) => setActiveSelection(hasSelection ? "case" : null)}
              isLocked={activeSelection === "user"}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

// ユーザー → ケース割り当てビュー
function UserToCaseView({
  users,
  cases,
  onSelectionChange,
  isLocked,
}: {
  users: { id: string; name: string; email: string }[];
  cases: { id: string; name: string }[];
  onSelectionChange: (hasSelection: boolean) => void;
  isLocked: boolean;
}) {
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedCases, setAssignedCases] = useState<{ [userId: string]: string[] }>({});

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectUser = (userId: string) => {
    if (isLocked) return;
    setSelectedUser(userId);
    onSelectionChange(true);
  };

  const handleClear = () => {
    setSelectedUser(null);
    onSelectionChange(false);
  };

  const toggleCase = (caseId: string) => {
    if (!selectedUser) return;
    setAssignedCases((prev) => {
      const current = prev[selectedUser] || [];
      if (current.includes(caseId)) {
        return { ...prev, [selectedUser]: current.filter((id) => id !== caseId) };
      }
      if (current.length >= MAX_ASSIGNMENTS) return prev;
      return { ...prev, [selectedUser]: [...current, caseId] };
    });
  };

  const currentAssignCount = selectedUser ? (assignedCases[selectedUser]?.length || 0) : 0;

  const selectedUserData = users.find((u) => u.id === selectedUser);

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
            const isSelected = selectedUser === user.id;
            const assignCount = assignedCases[user.id]?.length || 0;
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
                  {user.name.charAt(0)}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span
                    className="font-black text-sm truncate inline-block pb-0.5"
                    style={{
                      color: isSelected ? "var(--primary)" : "#323232",
                      borderBottom: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                    }}
                  >
                    {user.name}
                  </span>
                  <p
                    className="text-xs font-bold truncate"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {user.email}
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
        {selectedUserData ? (
          <>
            {/* 選択中ユーザー表示 */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-black"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {selectedUserData.name.charAt(0)}
              </div>
              <div className="flex-1">
                <p className="font-black text-lg" style={{ color: "#323232" }}>
                  {selectedUserData.name}
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                  {selectedUserData.email}
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
                const isAssigned = assignedCases[selectedUser!]?.includes(caseItem.id);
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
                      <p
                        className="font-black text-sm truncate"
                        style={{ color: isAssigned ? "#fff" : "#323232" }}
                      >
                        {caseItem.name}
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
              <Button>保存</Button>
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

// ケース → ユーザー割り当てビュー
function CaseToUserView({
  users,
  cases,
  onSelectionChange,
  isLocked,
}: {
  users: { id: string; name: string; email: string }[];
  cases: { id: string; name: string }[];
  onSelectionChange: (hasSelection: boolean) => void;
  isLocked: boolean;
}) {
  const [selectedCase, setSelectedCase] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [assignedUsers, setAssignedUsers] = useState<{ [caseId: string]: string[] }>({});

  const filteredCases = cases.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelectCase = (caseId: string) => {
    if (isLocked) return;
    setSelectedCase(caseId);
    onSelectionChange(true);
  };

  const handleClear = () => {
    setSelectedCase(null);
    onSelectionChange(false);
  };

  const toggleUser = (userId: string) => {
    if (!selectedCase) return;
    setAssignedUsers((prev) => {
      const current = prev[selectedCase] || [];
      if (current.includes(userId)) {
        return { ...prev, [selectedCase]: current.filter((id) => id !== userId) };
      }
      if (current.length >= MAX_ASSIGNMENTS) return prev;
      return { ...prev, [selectedCase]: [...current, userId] };
    });
  };

  const currentAssignCount = selectedCase ? (assignedUsers[selectedCase]?.length || 0) : 0;
  const selectedCaseData = cases.find((c) => c.id === selectedCase);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      {/* ケースリスト - 左側コンパクト */}
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
            placeholder="ケースを検索..."
            className="w-full bg-transparent text-sm font-bold outline-none"
            style={{ color: "#323232" }}
          />
        </div>

        {/* ケースリスト */}
        <div className="space-y-0.5 max-h-96 overflow-y-auto">
          {filteredCases.map((caseItem) => {
            const isSelected = selectedCase === caseItem.id;
            const assignCount = assignedUsers[caseItem.id]?.length || 0;
            return (
              <button
                key={caseItem.id}
                onClick={() => handleSelectCase(caseItem.id)}
                disabled={isLocked}
                className="w-full flex items-center gap-3 p-2.5 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {/* アイコン */}
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: "var(--primary-light)" }}
                >
                  <FileQuestion className="w-5 h-5" style={{ color: "var(--primary)" }} />
                </div>
                <div className="flex-1 text-left min-w-0">
                  <span
                    className="font-black text-sm truncate inline-block pb-0.5"
                    style={{
                      color: isSelected ? "var(--primary)" : "#323232",
                      borderBottom: isSelected ? "2px solid var(--primary)" : "2px solid transparent",
                    }}
                  >
                    {caseItem.name}
                  </span>
                  <p
                    className="text-xs font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {caseItem.id}
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
                    {assignCount}人
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* ユーザー割り当て - 右側メイン */}
      <div
        className="lg:col-span-3 rounded-xl p-5 lg:p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {selectedCaseData ? (
          <>
            {/* 選択中ケース表示 */}
            <div className="flex items-center gap-4 mb-6 pb-6 border-b" style={{ borderColor: "var(--border)" }}>
              <div
                className="w-14 h-14 rounded-xl flex items-center justify-center"
                style={{ background: "var(--primary)" }}
              >
                <FileQuestion className="w-7 h-7" style={{ color: "#fff" }} />
              </div>
              <div className="flex-1">
                <p className="font-black text-lg" style={{ color: "#323232" }}>
                  {selectedCaseData.name}
                </p>
                <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                  {selectedCaseData.id}
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
                ユーザーを選択
              </p>
              <p
                className="text-sm font-black"
                style={{ color: currentAssignCount >= MAX_ASSIGNMENTS ? "var(--error)" : "var(--primary)" }}
              >
                {currentAssignCount} / {MAX_ASSIGNMENTS}
              </p>
            </div>

            {/* ユーザーリスト */}
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {users.map((user) => {
                const isAssigned = assignedUsers[selectedCase!]?.includes(user.id);
                const isDisabled = !isAssigned && currentAssignCount >= MAX_ASSIGNMENTS;
                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
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
                    {/* アバター */}
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
                      style={{
                        background: isAssigned ? "rgba(255,255,255,0.2)" : "var(--primary-light)",
                        color: isAssigned ? "#fff" : "var(--primary)",
                      }}
                    >
                      {user.name.charAt(0)}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                      <p
                        className="font-black text-sm truncate"
                        style={{ color: isAssigned ? "#fff" : "#323232" }}
                      >
                        {user.name}
                      </p>
                      <p
                        className="text-xs font-bold truncate"
                        style={{ color: isAssigned ? "rgba(255,255,255,0.7)" : "var(--text-muted)" }}
                      >
                        {user.email}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 保存ボタン */}
            <div className="mt-6 pt-4 border-t flex justify-end" style={{ borderColor: "var(--border)" }}>
              <Button>保存</Button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <div
              className="w-20 h-20 rounded-xl flex items-center justify-center mb-4"
              style={{ background: "var(--background)" }}
            >
              <FileQuestion className="w-10 h-10" style={{ color: "var(--text-muted)" }} />
            </div>
            <p className="font-black text-lg mb-1" style={{ color: "#323232" }}>
              ケースを選択
            </p>
            <p className="font-bold text-sm" style={{ color: "var(--text-muted)" }}>
              左のリストからケースを選んでください
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
