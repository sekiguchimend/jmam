"use client";

import { useEffect, useState } from "react";
import { DashboardNavClient } from "@/components/layout/DashboardNavClient";
import HelpContent from "./HelpContent";

interface UserInfo {
  isAdmin: boolean;
  name: string | null;
  email: string;
}

export default function HelpPageClient() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    // クッキーからサイドバー状態を取得
    const collapsed = document.cookie
      .split("; ")
      .find((row) => row.startsWith("sidebar-collapsed="))
      ?.split("=")[1] === "true";
    setSidebarCollapsed(collapsed);

    // ユーザー情報を取得
    async function fetchUserInfo() {
      try {
        const { getUserInfo } = await import("@/actions/profile");
        const info = await getUserInfo();
        if (info) {
          setUserInfo({
            isAdmin: info.isAdmin,
            name: info.name,
            email: info.email,
          });
        }
      } catch {
        // エラー時はデフォルト値を使用
        setUserInfo({
          isAdmin: false,
          name: null,
          email: "",
        });
      }
    }
    fetchUserInfo();
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
