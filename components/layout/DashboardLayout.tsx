import { DashboardNavClient } from "./DashboardNavClient";

interface DashboardLayoutProps {
  children: React.ReactNode;
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string;
}

export function DashboardLayout({ children, isAdmin, userName, userEmail }: DashboardLayoutProps) {
  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* ナビゲーション（開閉などのUIだけClientに閉じる） */}
      <DashboardNavClient isAdmin={isAdmin} userName={userName} userEmail={userEmail} />

      {/* メインコンテンツ */}
      <main className="lg:pl-64 pt-14 lg:pt-0">
        <div className="p-4 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  );
}
