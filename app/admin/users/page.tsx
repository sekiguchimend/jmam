// 管理者：ユーザー管理（一覧）
import dynamic from 'next/dynamic';
import { getUserWithRole } from '@/lib/supabase/server';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { adminListUsers } from '@/actions/adminUsers';

// dynamic importでクライアントコンポーネントを遅延ロード
const AdminUsersClient = dynamic(
  () => import('./usersClient').then(mod => mod.AdminUsersClient),
  { loading: () => <div className="animate-pulse p-8 text-center">読み込み中...</div> }
);

export const metadata = {
  title: "ユーザー管理",
};

export default async function AdminUsersPage() {
  const userInfo = await getUserWithRole();
  let initial = { users: [], page: 1, perPage: 50 } as Awaited<ReturnType<typeof adminListUsers>>;
  let loadError: string | null = null;
  try {
    initial = await adminListUsers({ page: 1, perPage: 50 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'ユーザー一覧の取得に失敗しました';
  }

  return (
    <DashboardLayout isAdmin={userInfo.isAdmin} userName={userInfo.name} userEmail={userInfo.email}>
      <AdminUsersClient initial={initial} loadError={loadError} />
    </DashboardLayout>
  );
}


