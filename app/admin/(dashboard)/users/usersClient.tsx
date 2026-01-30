// 管理者：ユーザー管理（Client）

'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Button } from '@/components/ui';
import { adminDeleteUser, adminListUsers, adminSetUserAdmin, adminSetUserStatus } from '@/actions/adminUsers';
import { Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { CreateUserInline } from './CreateUserInline';

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: Record<string, unknown>;
  status: 'active' | 'suspended' | 'deleted';
  is_admin: boolean;
};

// ステータス設定の定数マップ
const STATUS_CONFIG = {
  active: { label: '稼働', bg: '#16a34a' },
  suspended: { label: '停止', bg: '#f59e0b' },
  deleted: { label: '消去', bg: '#6b7280' },
} as const;

export function AdminUsersClient(props: {
  initial: { users: AuthUser[]; page: number; perPage: number };
  loadError: string | null;
}) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(props.initial.page);
  const [perPage] = useState(props.initial.perPage);
  const [users, setUsers] = useState<AuthUser[]>(props.initial.users);
  const [isPending, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => (u.email ?? '').toLowerCase().includes(q) || u.id.toLowerCase().includes(q));
  }, [query, users]);

  const loadPage = (nextPage: number) => {
    startTransition(async () => {
      const res = await adminListUsers({ page: nextPage, perPage });
      setUsers(res.users);
      setPage(res.page);
    });
  };

  const reloadFirstPage = () => {
    startTransition(async () => {
      const res = await adminListUsers({ page: 1, perPage });
      setUsers(res.users);
      setPage(res.page);
      setQuery('');
      router.refresh();
    });
  };

  const toggleSuspend = (u: AuthUser) => {
    const next = u.status === 'suspended' ? 'active' : 'suspended';
    const label = next === 'suspended' ? '停止' : '再開';
    if (!confirm(`${u.email ?? u.id} を${label}しますか？`)) return;
    startTransition(async () => {
      const res = await adminSetUserStatus({ userId: u.id, status: next });
      if (!res.success) {
        alert(res.error ?? '更新に失敗しました');
        return;
      }
      await reloadFirstPage();
    });
  };

  const deleteUser = (u: AuthUser) => {
    if (!confirm(`${u.email ?? u.id} を消去しますか？\nこの操作は取り消せません。`)) return;
    startTransition(async () => {
      const res = await adminDeleteUser({ userId: u.id });
      if (!res.success) {
        alert(res.error ?? '消去に失敗しました');
        return;
      }
      await reloadFirstPage();
    });
  };

  const toggleAdmin = (u: AuthUser) => {
    const next = !u.is_admin;
    const label = next ? '管理者にする' : '一般に戻す';
    if (!confirm(`${u.email ?? u.id} を「${label}」でよろしいですか？`)) return;
    startTransition(async () => {
      const res = await adminSetUserAdmin({ userId: u.id, makeAdmin: next });
      if (!res.success) {
        alert(res.error ?? '更新に失敗しました');
        return;
      }
      await reloadFirstPage();
    });
  };

  return (
    <div className="max-w-7xl mx-auto animate-fade-in space-y-6">
      <div className="mb-2">
        <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: '#323232' }}>
          ユーザー管理
        </h1>
        <p className="text-sm lg:text-base font-bold" style={{ color: '#323232' }}>
          ユーザーの追加・停止・消去
        </p>
      </div>

      {props.loadError && (
        <div
          className="rounded-xl p-4 border text-sm font-black"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--error)' }}
        >
          {props.loadError}
        </div>
      )}

      <CreateUserInline onCreated={reloadFirstPage} disabled={isPending} />

      <Card title="ユーザー一覧">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center gap-2 flex-1 border rounded px-3 py-2" style={{ borderColor: 'var(--border)' }}>
            <Search className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="メール/ユーザーIDで絞り込み（このページ内）"
              className="w-full outline-none bg-transparent text-sm font-bold"
              style={{ color: '#323232' }}
            />
          </div>
          <Button
            variant="secondary"
            onClick={() => loadPage(Math.max(1, page - 1))}
            disabled={isPending || page <= 1}
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="secondary" onClick={() => loadPage(page + 1)} disabled={isPending || users.length < perPage}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr style={{ color: '#323232' }}>
                <th className="py-2 pr-4 text-left w-[20%]">メール</th>
                <th className="py-2 pr-4 text-center w-[10%]">権限</th>
                <th className="py-2 pr-4 text-center w-[10%]">状態</th>
                <th className="py-2 pr-4 text-left w-[16%]">作成日</th>
                <th className="py-2 pr-4 text-left w-[16%]">最終ログイン</th>
                <th className="py-2 pr-4 text-left w-[28%]">操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => {
                const { label: statusLabel, bg: statusBg } = STATUS_CONFIG[u.status];
                return (
                  <tr key={u.id} className="border-t" style={{ borderColor: 'var(--border)', color: '#323232' }}>
                    <td className="py-3 pr-4 font-bold text-left truncate" title={u.email ?? '-'}>{u.email ?? '-'}</td>
                    <td className="py-3 pr-4 text-center">
                      <span
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-black text-white"
                        style={{ background: u.is_admin ? '#2563eb' : '#6b7280' }}
                      >
                        {u.is_admin ? '管理者' : '一般'}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-center">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-black text-white" style={{ background: statusBg }}>
                        {statusLabel}
                      </span>
                    </td>
                    <td className="py-3 pr-4 font-bold text-left truncate" title={new Date(u.created_at).toLocaleString()}>{new Date(u.created_at).toLocaleString()}</td>
                    <td className="py-3 pr-4 font-bold text-left truncate" title={u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '-'}>
                      {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString() : '-'}
                    </td>
                    <td className="py-3 pr-4 text-left">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleAdmin(u)}
                          disabled={isPending || u.status === 'deleted'}
                        >
                          {u.is_admin ? '一般に戻す' : '管理者にする'}
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => toggleSuspend(u)}
                          disabled={isPending || u.status === 'deleted'}
                        >
                          {u.status === 'suspended' ? '再開' : '停止'}
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => deleteUser(u)} disabled={isPending}>
                          消去
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center font-bold" style={{ color: 'var(--text-muted)' }}>
                    ユーザーが見つかりません
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}


