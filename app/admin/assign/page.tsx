// スコア割り当て管理ページ
import { getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AssignClient } from "./AssignClient";

export default async function AssignPage() {
  const userInfo = await getUserWithRole();

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <AssignClient />
    </DashboardLayout>
  );
}
