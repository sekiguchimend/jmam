import { cookies } from "next/headers";
import { DashboardNavClient } from "./DashboardNavClient";

interface DashboardLayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string;
}

export async function DashboardLayout({ children, isAdmin, userName, userEmail }: DashboardLayoutProps) {
  const cookieStore = await cookies();
  const sidebarCollapsed = cookieStore.get("sidebar-collapsed")?.value === "true";

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* ナビゲーション（開閉などのUIだけClientに閉じる） */}
      <DashboardNavClient
        isAdmin={isAdmin}
        userName={userName}
        userEmail={userEmail}
        initialCollapsed={sidebarCollapsed}
      />

      {/* メインコンテンツ */}
      <main
        className="relative z-0 pt-14 lg:pt-0 max-lg:!pl-0"
        style={{ paddingLeft: sidebarCollapsed ? "80px" : "256px" }}
      >
        <div className="p-4 lg:p-8 max-lg:!pl-4">
          {children}
        </div>
      </main>
    </div>
  );
}
