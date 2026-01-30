// ダッシュボード共通レイアウト（Server Component）
// ユーザー情報の取得とサイドバーのレンダリングを1回だけ行う
import { redirect } from "next/navigation";
import { getUserWithRole, hasAnyAccessToken } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

export default async function DashboardRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // 認証チェック
  if (!(await hasAnyAccessToken())) {
    redirect("/login");
  }

  const userInfo = await getUserWithRole();
  if (!userInfo?.id) {
    redirect("/login");
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
