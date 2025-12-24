// スコア割り当て管理ページ
import { getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AssignClient } from "./AssignClient";
import { adminFetchAssignInitial } from "@/actions/assign";

export default async function AssignPage() {
  const userInfo = await getUserWithRole();
  let initial: Awaited<ReturnType<typeof adminFetchAssignInitial>> | null = null;
  let loadError: string | null = null;
  try {
    initial = await adminFetchAssignInitial();
  } catch (e) {
    loadError = e instanceof Error ? e.message : "初期データの取得に失敗しました";
  }

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <AssignClient initial={initial} loadError={loadError} />
    </DashboardLayout>
  );
}
