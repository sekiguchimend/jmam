// 管理者：ユーザー管理（一覧）
import { Suspense } from 'react';
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

// スケルトンローダー
function UsersSkeleton() {
  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 mb-2 animate-pulse" />
        <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse" />
      </div>
      <div
        className="rounded-xl p-8"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

// ユーザー一覧を取得するコンポーネント
async function UsersContent() {
  let initial = { users: [], page: 1, perPage: 50 } as Awaited<ReturnType<typeof adminListUsers>>;
  let loadError: string | null = null;
  try {
    initial = await adminListUsers({ page: 1, perPage: 50 });
  } catch (e) {
    loadError = e instanceof Error ? e.message : 'ユーザー一覧の取得に失敗しました';
  }

  return <AdminUsersClient initial={initial} loadError={loadError} />;
}

export default async function AdminUsersPage() {
  const userInfo = await getUserWithRole();

  return (
    <DashboardLayout isAdmin={userInfo.isAdmin} userName={userInfo.name} userEmail={userInfo.email}>
      <Suspense fallback={<UsersSkeleton />}>
        <UsersContent />
      </Suspense>
    </DashboardLayout>
  );
}


