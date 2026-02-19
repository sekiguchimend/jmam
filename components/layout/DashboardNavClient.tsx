// ダッシュボードのナビゲーション（Client Component）
// - モバイルのサイドバー開閉だけをClientに閉じる
// - コンテンツ（children）はServerのまま維持するため、ここでは受け取らない

"use client";

import { useState, useEffect, useCallback } from "react";
import { Sidebar } from "./Sidebar";
import { Menu } from "lucide-react";

export function DashboardNavClient({
  isAdmin,
  userName,
  userEmail,
  initialCollapsed = false,
}: {
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string;
  initialCollapsed?: boolean;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  // 開閉状態をCookieに保存
  const handleToggleCollapse = useCallback(() => {
    const newValue = !collapsed;
    setCollapsed(newValue);
    document.cookie = `sidebar-collapsed=${newValue}; path=/; max-age=31536000`;
  }, [collapsed]);

  // メインコンテンツの左パディングを調整（デスクトップのみ）
  useEffect(() => {
    const main = document.querySelector("main");
    if (!main) return;

    const updatePadding = () => {
      const isDesktop = window.matchMedia("(min-width: 1024px)").matches;
      if (isDesktop) {
        main.style.transition = "padding-left 0.3s ease-in-out";
        main.style.paddingLeft = collapsed ? "80px" : "256px";
      } else {
        main.style.paddingLeft = "0px";
      }
    };

    updatePadding();
    window.addEventListener("resize", updatePadding);
    return () => window.removeEventListener("resize", updatePadding);
  }, [collapsed]);

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
          解答予測
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
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />
    </>
  );
}


