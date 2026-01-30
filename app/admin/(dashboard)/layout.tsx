// 管理者ダッシュボード共通レイアウト（Server Component）
// ユーザー情報の取得とサイドバーのレンダリングを1回だけ行う
import { redirect } from "next/navigation";
import { getUserWithRole, hasAccessToken } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default async function AdminDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 管理者認証チェック
  if (!(await hasAccessToken())) {
    redirect("/login?redirect=/admin");
  }

  const userInfo = await getUserWithRole();
  if (!userInfo?.id || !userInfo.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      {children}
    </DashboardLayout>
  );
}
