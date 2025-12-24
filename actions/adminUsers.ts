// 管理者向けユーザー管理のServer Actions
// - 一覧取得（Supabase Auth）
// - ユーザー追加（Supabase Auth）
// - ユーザー詳細取得（Supabase Auth）

'use server';

import { hasAccessToken } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/supabase/server';
import { supabaseAnonServer } from '@/lib/supabase/anon-server';
import type { Database } from '@/types/database';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { getAuthedUserId } from '@/lib/supabase/server';

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: Record<string, unknown>;
  status: 'active' | 'suspended' | 'deleted';
};

async function ensureAdmin(): Promise<void> {
  // middlewareで /admin は保護済みだが、念のためServer Action単体でもチェック
  if (!(await hasAccessToken())) {
    throw new Error('管理者権限が必要です');
  }
}

export async function adminListUsers(params?: {
  page?: number;
  perPage?: number;
}): Promise<{
  users: AuthUser[];
  page: number;
  perPage: number;
}> {
  await ensureAdmin();
  const token = await getAccessToken();
  if (!token) throw new Error('管理者権限が必要です');

  const page = params?.page ?? 1;
  const perPage = params?.perPage ?? 50;

  // anon keyのみで実現するため、Authの管理APIは使わず public.profiles を参照する
  const supabase = createAuthedAnonServerClient(token);
  const from = (page - 1) * perPage;
  const to = from + perPage - 1;

  type ProfileRow = Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'email' | 'name' | 'created_at' | 'status'
  >;

  const res = await supabase
    .from('profiles')
    .select('id, email, name, status, created_at', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(from, to);
  const { data, error, status, statusText } = res as any;

  if (error) {
    // supabase-jsのerrorは列挙不可プロパティが多いので、見える形でログを出す
    const e = error as any;
    console.error('adminListUsers error:', {
      status,
      statusText,
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      code: e?.code,
    });
    if (status === 401 || status === 403) {
      throw new Error('権限がありません。再ログインしてください。');
    }
    throw new Error('ユーザー一覧の取得に失敗しました');
  }

  const users: AuthUser[] =
    (data as ProfileRow[] | null)?.map((p) => ({
      id: p.id,
      email: p.email ?? null,
      created_at: p.created_at,
      last_sign_in_at: null, // anon key運用ではAuthの最終ログインは取得しない
      user_metadata: { name: p.name ?? '' },
      status: p.status,
    })) ?? [];

  return { users, page, perPage };
}

export async function adminGetUserById(params: { userId: string }): Promise<AuthUser | null> {
  await ensureAdmin();
  const token = await getAccessToken();
  if (!token) return null;
  const { userId } = params;

  const supabase = createAuthedAnonServerClient(token);
  type ProfileRow = Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'email' | 'name' | 'created_at' | 'status'
  >;
  const res = await supabase
    .from('profiles')
    .select('id, email, name, status, created_at')
    .eq('id', userId)
    .maybeSingle();
  const { data, error } = res as unknown as { data: ProfileRow | null; error: unknown };

  if (error) {
    console.error('adminGetUserById error:', error);
    return null;
  }
  if (!data) return null;

  return {
    id: data.id,
    email: data.email ?? null,
    created_at: data.created_at,
    last_sign_in_at: null,
    user_metadata: { name: data.name ?? '' },
    status: data.status,
  };
}

export async function adminSetUserStatus(params: {
  userId: string;
  status: 'active' | 'suspended';
}): Promise<{ success: boolean; error?: string }> {
  await ensureAdmin();
  const token = await getAccessToken();
  if (!token) return { success: false, error: '管理者権限が必要です' };

  const currentAdminId = await getAuthedUserId();
  if (currentAdminId && params.userId === currentAdminId) {
    return { success: false, error: '自分自身は停止/再開できません' };
  }

  const supabase = createAuthedAnonServerClient(token);
  const { error } = await supabase
    .from('profiles')
    .update({ status: params.status })
    .eq('id', params.userId);

  if (error) {
    console.error('adminSetUserStatus error:', error);
    return { success: false, error: '更新に失敗しました' };
  }

  // 停止→ログイン拒否は login 側でprofiles.statusをチェックして実現する
  return { success: true };
}

export async function adminDeleteUser(params: {
  userId: string;
}): Promise<{ success: boolean; error?: string }> {
  await ensureAdmin();
  const token = await getAccessToken();
  if (!token) return { success: false, error: '管理者権限が必要です' };

  const currentAdminId = await getAuthedUserId();
  if (currentAdminId && params.userId === currentAdminId) {
    return { success: false, error: '自分自身は消去できません' };
  }

  const supabase = createAuthedAnonServerClient(token);

  // adminユーザーを消去すると運用事故になりやすいので禁止
  const adminCheck = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', params.userId)
    .eq('is_active', true)
    .maybeSingle();
  if (adminCheck.data?.id) {
    return { success: false, error: '管理者ユーザーは消去できません（先に管理者権限を外してください）' };
  }

  // ブロックテーブルに登録（Authユーザー自体はanon keyでは消せないため、再ログイン防止）
  const profile = await supabase.from('profiles').select('email').eq('id', params.userId).maybeSingle();
  await supabase.from('user_blocks').insert({
    user_id: params.userId,
    email: (profile.data as any)?.email ?? null,
    reason: 'deleted',
  });

  // 関連データを削除（要件: 消去はデータを消してよい）
  await supabase.from('user_score_records').delete().eq('user_id', params.userId);
  await supabase.from('profiles').delete().eq('id', params.userId);

  return { success: true };
}

export async function adminCreateUser(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  await ensureAdmin();

  const email = String(formData.get('email') ?? '').trim();
  const password = String(formData.get('password') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();

  if (!email || !password) {
    return { success: false, error: 'メールアドレスとパスワードを入力してください' };
  }

  // anon keyのみの方針では、Auth Admin API(=service_role)が使えないため signUp を利用する。
  // その場合、メール確認が必要（プロジェクト設定に依存）で、即時の強制確認はできない。
  const { error } = await supabaseAnonServer.auth.signUp({
    email,
    password,
    options: {
      data: name ? { name } : undefined,
    },
  });

  if (error) {
    console.error('adminCreateUser error:', error);
    return { success: false, error: `ユーザー作成に失敗しました: ${error.message}` };
  }

  return { success: true };
}


