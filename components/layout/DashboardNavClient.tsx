// ダッシュボードのナビゲーション（Client Component）
// - モバイルのサイドバー開閉だけをClientに閉じる
// - コンテンツ（children）はServerのまま維持するため、ここでは受け取らない

"use client";

import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

export function DashboardNavClient({
  isAdmin,
  userName,
  userEmail,
}: {
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      {/* モバイルヘッダー */}
      <header
        className="lg:hidden fixed top-0 left-0 right-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{ background: "var(--sidebar)" }}
      >
        <button
          onClick={() => setSidebarOpen(true)}
          className="p-2 rounded-lg"
          style={{ color: "var(--text-inverse)" }}
        >
          <Menu className="w-6 h-6" />
        </button>
        <span className="text-lg font-black" style={{ color: "var(--text-inverse)" }}>
          ScorePredict
        </span>
        <div className="w-10" /> {/* スペーサー */}
      </header>

      {/* サイドバー */}
      <Sidebar
        isAdmin={isAdmin}
        userName={userName}
        userEmail={userEmail}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
}


