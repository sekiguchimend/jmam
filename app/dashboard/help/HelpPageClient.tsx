"use client";

import { useEffect, useState, useMemo } from "react";
import { DashboardNavClient } from "@/components/layout/DashboardNavClient";
import HelpContent from "./HelpContent";
import { getUserInfo } from "@/actions/profile";

interface UserInfo {
  isAdmin: boolean;
  name: string | null;
  email: string;
}

// クッキーからサイドバー状態を取得するヘルパー関数
const getSidebarCollapsedFromCookie = (): boolean => {
  if (typeof document === "undefined") return false;
  return document.cookie
    .split("; ")
    .find((row) => row.startsWith("sidebar-collapsed="))
    ?.split("=")[1] === "true";
};

export default function HelpPageClient() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);

  // 初回レンダリング時にクッキーから取得（useMemoで1回のみ計算）
  const initialSidebarCollapsed = useMemo(() => getSidebarCollapsedFromCookie(), []);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(initialSidebarCollapsed);

  useEffect(() => {
    // ユーザー情報を取得（静的importを使用）
    let isMounted = true;

    async function fetchUserInfo() {
      try {
        const info = await getUserInfo();
        if (isMounted && info) {
          setUserInfo({
            isAdmin: info.isAdmin,
            name: info.name,
            email: info.email,
          });
        }
      } catch {
        // エラー時はデフォルト値を使用
        if (isMounted) {
          setUserInfo({
            isAdmin: false,
            name: null,
            email: "",
          });
        }
      }
    }
    fetchUserInfo();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      <DashboardNavClient
        isAdmin={userInfo?.isAdmin ?? false}
        userName={userInfo?.name}
        userEmail={userInfo?.email}
        initialCollapsed={sidebarCollapsed}
      />

      {/* DashboardNavClientがmainのpaddingLeftをJS側で制御する */}
      <main className="relative z-0 pt-14 lg:pt-0 max-lg:!pl-0">
        <div className="p-4 lg:p-8 max-lg:!pl-4">
          <HelpContent />
        </div>
      </main>
    </div>
  );
}
