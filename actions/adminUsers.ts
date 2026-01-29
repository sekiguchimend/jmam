// 管理者向けユーザー管理のServer Actions
// - 一覧取得（Supabase Auth）
// - ユーザー追加（Supabase Auth）
// - ユーザー詳細取得（Supabase Auth）

'use server';

import { hasAccessToken } from '@/lib/supabase/server';
import { getAccessToken } from '@/lib/supabase/server';
import { supabaseAnonServer } from '@/lib/supabase/anon-server';
import { supabaseServiceRole } from '@/lib/supabase/service-role';
import type { Database } from '@/types/database';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { getAuthedUserId } from '@/lib/supabase/server';

type PostgrestErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

type AuthUser = {
  id: string;
  email: string | null;
  created_at: string;
  last_sign_in_at: string | null;
  user_metadata: Record<string, unknown>;
  status: 'active' | 'suspended' | 'deleted';
  is_admin: boolean;
};

async function upsertAdminUser(params: {
  supabase: ReturnType<typeof createAuthedAnonServerClient>;
  userId: string;
  email: string;
  name: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  type AdminInsert = Database['public']['Tables']['admin_users']['Insert'];
  const adminRes = await params.supabase.from('admin_users').upsert(
    {
      id: params.userId,
      email: params.email,
      name: params.name,
      role: 'admin',
      is_active: true,
    } satisfies AdminInsert,
    { onConflict: 'id' }
  );
  if (adminRes.error) {
    console.error('admin_users upsert error:', adminRes.error);
    return { ok: false, error: '管理者登録に失敗しました' };
  }
  return { ok: true };
}

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
  const offset = (page - 1) * perPage;

  // RPC関数で1クエリでprofilesとadmin_usersをLEFT JOINして取得
  const supabase = createAuthedAnonServerClient(token);

  type UserRow = {
    id: string;
    email: string | null;
    name: string | null;
    status: 'active' | 'suspended' | 'deleted';
    created_at: string;
    is_admin: boolean;
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const res = await (supabase.rpc as any)('list_users_with_admin_status', {
    p_limit: perPage,
    p_offset: offset,
  });

  if (res.error) {
    const e = res.error as unknown as PostgrestErrorLike;
    console.error('adminListUsers error:', {
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      code: e?.code,
    });
    if (res.status === 401 || res.status === 403) {
      throw new Error('権限がありません。再ログインしてください。');
    }
    throw new Error('ユーザー一覧の取得に失敗しました');
  }

  const rows = (res.data as UserRow[] | null) ?? [];

  const users: AuthUser[] = rows.map((r) => ({
    id: r.id,
    email: r.email ?? null,
    created_at: r.created_at,
    last_sign_in_at: null, // anon key運用ではAuthの最終ログインは取得しない
    user_metadata: { name: r.name ?? '' },
    status: r.status,
    is_admin: r.is_admin,
  }));

  return { users, page, perPage };
}

export async function adminSetUserAdmin(params: {
  userId: string;
  makeAdmin: boolean;
}): Promise<{ success: boolean; error?: string }> {
  await ensureAdmin();
  const token = await getAccessToken();
  if (!token) return { success: false, error: '管理者権限が必要です' };

  const currentAdminId = await getAuthedUserId();
  if (currentAdminId && params.userId === currentAdminId && !params.makeAdmin) {
    return { success: false, error: '自分自身の管理者権限は外せません' };
  }

  const supabase = createAuthedAnonServerClient(token);

  if (!params.makeAdmin) {
    const { error } = await supabase.from('admin_users').update({ is_active: false }).eq('id', params.userId);
    if (error) {
      console.error('adminSetUserAdmin demote error:', error);
      return { success: false, error: '権限変更に失敗しました' };
    }
    return { success: true };
  }

  // 昇格：admin_users へ upsert（表示用にemail/nameも保存）
  const prof = await supabase.from('profiles').select('email, name').eq('id', params.userId).maybeSingle();
  const email = prof.data?.email ?? null;
  const name = prof.data?.name ?? null;
  if (!email) return { success: false, error: 'メールアドレスが見つかりません' };

  type AdminInsert = Database['public']['Tables']['admin_users']['Insert'];
  const { error } = await supabase.from('admin_users').upsert(
    {
      id: params.userId,
      email,
      name,
      role: 'admin',
      is_active: true,
    } satisfies AdminInsert,
    { onConflict: 'id' }
  );
  if (error) {
    console.error('adminSetUserAdmin promote error:', error);
    return { success: false, error: '権限変更に失敗しました' };
  }

  return { success: true };
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

  // 管理者かどうかをチェック
  const adminRes = await supabase
    .from('admin_users')
    .select('id')
    .eq('id', userId)
    .eq('is_active', true)
    .maybeSingle();
  const isAdmin = !adminRes.error && adminRes.data !== null;

  return {
    id: data.id,
    email: data.email ?? null,
    created_at: data.created_at,
    last_sign_in_at: null,
    user_metadata: { name: data.name ?? '' },
    status: data.status,
    is_admin: isAdmin,
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

  // 関連データを削除（要件: 消去はデータを消してよい）
  await supabase.from('user_score_records').delete().eq('user_id', params.userId);
  await supabase.from('profiles').delete().eq('id', params.userId);

  // Supabase Auth からユーザーを削除（service_role key使用）
  const { error: authDeleteError } = await supabaseServiceRole.auth.admin.deleteUser(params.userId);
  if (authDeleteError) {
    console.error('Auth user delete error:', authDeleteError);
    // profiles等は既に削除済みなので、Authの削除失敗は警告として扱う
    // 運用上、Authに残っても再登録時に問題が出るだけなので続行
  }

  return { success: true };
}

export async function adminCreateUser(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  await ensureAdmin();

  const email = String(formData.get('email') ?? '').trim().toLowerCase();
  const password = String(formData.get('password') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const role = String(formData.get('role') ?? 'user').trim(); // 'user' | 'admin'

  if (!email || !password) {
    return { success: false, error: 'メールアドレスとパスワードを入力してください' };
  }

  const token = await getAccessToken();
  if (!token) return { success: false, error: '管理者権限が必要です' };
  const supabase = createAuthedAnonServerClient(token);

  // anon keyのみの方針では、Auth Admin API(=service_role)が使えないため signUp を利用する。
  // その場合、メール確認が必要（プロジェクト設定に依存）で、即時の強制確認はできない。
  const { data, error } = await supabaseAnonServer.auth.signUp({
    email,
    password,
    options: {
      data: name ? { name } : undefined,
    },
  });

  if (error) {
    // 既存ユーザーの場合、管理者として登録するなら admin_users に追加
    if (error.code === 'user_already_exists') {
      if (role === 'admin') {
        // このメールアドレスは Auth 上で既に存在している（=新規作成はできない）。
        // ただし、運用上 profiles を削除しても Auth ユーザーは残るため、
        // 「Auth にはいるが profiles が無い」状態が起こり得る。
        //
        // まず profiles からユーザーIDを取得し、見つかったら admin_users に登録する。
        const existingUser = await supabase
          .from('profiles')
          .select('id')
          .eq('email', email)
          .maybeSingle();

        if (existingUser.data?.id) {
          const promoted = await upsertAdminUser({
            supabase,
            userId: existingUser.data.id,
            email,
            name: name || null,
          });
          if (!promoted.ok) return { success: false, error: promoted.error };
          return { success: true };
        }

        // profiles が見つからない場合：削除済み or 未同期の可能性がある。
        // 管理者のみが使えるDB関数で profiles を復元できるので、それを試す。
        const restored = await supabase.rpc('admin_restore_profile_by_email', {
          p_email: email,
          p_name: name || null,
        });
        const restoredId = restored.data as string | null;
        if (restored.error) {
          console.error('admin_restore_profile_by_email error:', restored.error);
        }
        if (restoredId) {
          const promoted = await upsertAdminUser({
            supabase,
            userId: restoredId,
            email,
            name: name || null,
          });
          if (!promoted.ok) return { success: false, error: promoted.error };
          return { success: true };
        }

        // 復元できなかった場合：ブロック済み or Auth上にも見つからない等
        const blocked = await supabase.from('user_blocks').select('email').eq('email', email).maybeSingle();
        if (blocked.data?.email) {
          return {
            success: false,
            error:
              'このメールアドレスは「消去済みユーザー」として登録されています（Auth には残っているため再作成できません）。SupabaseのAuthユーザーを削除するか、別のメールアドレスを使用してください。',
          };
        }

        return {
          success: false,
          error:
            'このメールアドレスは既に登録されていますが、ユーザー情報の復元に失敗しました（profilesが存在しない可能性があります）。過去に消去された可能性があります。SupabaseのAuthユーザーを削除するか、別のメールアドレスを使用してください。',
        };
      }
      return {
        success: false,
        error:
          'このメールアドレスは既に登録されています（Auth上にユーザーが存在するため、新規作成できません）。別のメールアドレスを使用してください。',
      };
    }

    console.error('adminCreateUser error:', error);
    return { success: false, error: `ユーザー作成に失敗しました: ${error.message}` };
  }

  // 作成時に「管理者」を選んだ場合は admin_users に登録
  if (role === 'admin' && data?.user?.id) {
    const promoted = await upsertAdminUser({
      supabase,
      userId: data.user.id,
      email,
      name: name || null,
    });
    if (!promoted.ok) return { success: false, error: 'ユーザー作成後の権限付与に失敗しました' };
  }

  return { success: true };
}


