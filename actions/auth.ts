// 認証関連のServer Actions
// FR-06: 管理画面認証
// クッキーベースのアクセストークン管理

'use server';

import {
  createSupabaseServerClient,
  getAccessToken,
  ADMIN_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  MFA_PENDING_ACCESS_TOKEN_COOKIE,
  MFA_PENDING_REFRESH_TOKEN_COOKIE,
  MFA_PENDING_IS_ADMIN_COOKIE,
  MFA_PENDING_REDIRECT_COOKIE,
} from '@/lib/supabase/server';
import type { Database } from '@/types/database';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { setMfaPendingCookies } from '@/actions/mfa';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { headers } from 'next/headers';
import type { AuthError } from '@supabase/supabase-js';

// クッキーの有効期限（7日間）
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

function isDevMfaBypass(host: string | null): boolean {
  // 開発中（localhost）だけMFA必須を無効化
  if (process.env.NODE_ENV === 'production') return false;
  const h = (host ?? '').toLowerCase();
  return h.includes('localhost') || h.includes('127.0.0.1');
}

// ログイン
export async function login(formData: FormData): Promise<{
  success: boolean;
  error?: string;
  redirectTo?: string;
}> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const redirectTo = (formData.get('redirect') as string | null) ?? null;

  if (!email) {
    return { success: false, error: 'メールアドレスを入力してください' };
  }
  if (!password) {
    return { success: false, error: 'パスワードを入力してください' };
  }

  const supabase = await createSupabaseServerClient();

  // 通常ログイン（メール+パスワード）に戻す
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    const e = error as AuthError;
    console.error('signInWithPassword error:', {
      message: e.message,
      status: e.status,
      code: e.code,
      name: e.name,
    });
    return { success: false, error: 'ログインに失敗しました（メールまたはパスワードをご確認ください）' };
  }

  if (!data.user || !data.session) {
    return { success: false, error: 'ログインに失敗しました' };
  }

  // 停止/消去/ブロックのユーザーはログイン不可
  try {
    const db = createAuthedAnonServerClient(data.session.access_token);
    const blocked = await db.from('user_blocks').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (blocked.data?.user_id) {
      await supabase.auth.signOut();
      return { success: false, error: 'このアカウントは利用できません（消去済み）' };
    }
    const profile = await db.from('profiles').select('status').eq('id', data.user.id).maybeSingle();
    if (!profile.data) {
      await supabase.auth.signOut();
      return { success: false, error: 'このアカウントは利用できません' };
    }
    const status = (profile.data as { status?: string } | null)?.status;
    if (status && status !== 'active') {
      await supabase.auth.signOut();
      return {
        success: false,
        error: status === 'suspended' ? 'このアカウントは停止中です' : 'このアカウントは利用できません',
      };
    }
  } catch (e) {
    console.error('login status check error:', e);
    await supabase.auth.signOut();
    return { success: false, error: 'ログイン状態の確認に失敗しました。管理者に連絡してください。' };
  }

  // admin_users に存在すれば管理者、それ以外は一般ユーザーとして扱う
  const { data: adminUser, error: adminError } = await supabase
    .from('admin_users')
    .select('id, is_active')
    .eq('id', data.user.id)
    .eq('is_active', true)
    .maybeSingle();

  const isAdmin = !!adminUser && !adminError;

  // 開発環境（localhost）ではMFAをスキップしてログイン可能にする
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  if (isDevMfaBypass(host)) {
    const cookieStore = await cookies();

    // pendingが残っていると /mfa に飛び続けるので確実に消す
    cookieStore.delete(MFA_PENDING_ACCESS_TOKEN_COOKIE);
    cookieStore.delete(MFA_PENDING_REFRESH_TOKEN_COOKIE);
    cookieStore.delete(MFA_PENDING_IS_ADMIN_COOKIE);
    cookieStore.delete(MFA_PENDING_REDIRECT_COOKIE);

    const commonCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    };

    cookieStore.set(USER_TOKEN_COOKIE, data.session.access_token, commonCookie);
    cookieStore.set(USER_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
    if (isAdmin) {
      cookieStore.set(ADMIN_TOKEN_COOKIE, data.session.access_token, commonCookie);
      cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
    } else {
      cookieStore.delete(ADMIN_TOKEN_COOKIE);
      cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);
    }

    const resolvedRedirect = redirectTo ?? (isAdmin ? '/admin' : '/dashboard');
    revalidatePath('/', 'layout');
    return { success: true, redirectTo: resolvedRedirect };
  }

  // MFA必須：AAL2（2段階認証完了）になるまでアプリのログインCookieを発行しない
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) {
    console.error('getAuthenticatorAssuranceLevel error:', aal.error);
    return { success: false, error: 'MFA状態の取得に失敗しました' };
  }
  if (aal.data.currentLevel !== 'aal2') {
    // MFA途中用の一時トークンを保存（10分）
    await setMfaPendingCookies({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      isAdmin,
      redirectTo: redirectTo ?? (isAdmin ? '/admin' : '/dashboard'),
    });

    // 既存ログインCookieを念のため削除
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_TOKEN_COOKIE);
    cookieStore.delete(USER_TOKEN_COOKIE);

    return { success: true, redirectTo: '/mfa' };
  }

  // アクセストークンをクッキーに保存
  const cookieStore = await cookies();
  const commonCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };

  // 一般ユーザーは user_access_token、管理者は admin_access_token も付与
  cookieStore.set(USER_TOKEN_COOKIE, data.session.access_token, commonCookie);
  cookieStore.set(USER_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
  if (isAdmin) {
    cookieStore.set(ADMIN_TOKEN_COOKIE, data.session.access_token, commonCookie);
    cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
  } else {
    cookieStore.delete(ADMIN_TOKEN_COOKIE);
    cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);
  }

  const resolvedRedirect = redirectTo ?? (isAdmin ? '/admin' : '/dashboard');
  revalidatePath('/', 'layout');
  return { success: true, redirectTo: resolvedRedirect };
}

// ログアウト
export async function logout(): Promise<void> {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();

  // クッキーを削除
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_TOKEN_COOKIE);
  cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);
  cookieStore.delete(USER_TOKEN_COOKIE);
  cookieStore.delete(USER_REFRESH_TOKEN_COOKIE);
  // MFA途中のクッキーも削除
  cookieStore.delete(MFA_PENDING_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(MFA_PENDING_REFRESH_TOKEN_COOKIE);
  cookieStore.delete(MFA_PENDING_IS_ADMIN_COOKIE);
  cookieStore.delete(MFA_PENDING_REDIRECT_COOKIE);

  revalidatePath('/', 'layout');
  redirect('/login');
}

// 管理者ユーザーを作成（初期セットアップ用）
export async function createAdminUser(formData: FormData): Promise<{
  success: boolean;
  error?: string;
}> {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const name = formData.get('name') as string;

  if (!email || !password) {
    return { success: false, error: 'メールアドレスとパスワードを入力してください' };
  }

  const supabase = await createSupabaseServerClient();

  // Supabase Authでユーザー作成
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });

  if (error) {
    console.error('SignUp error:', error);
    return { success: false, error: `ユーザー作成に失敗しました: ${error.message}` };
  }

  if (!data.user) {
    return { success: false, error: 'ユーザー作成に失敗しました' };
  }

  // admin_usersテーブルに追加
  type AdminUserInsert = Database['public']['Tables']['admin_users']['Insert'];
  const { error: insertError } = await supabase.from('admin_users').insert({
    id: data.user.id,
    email,
    name: name || null,
    role: 'admin',
    is_active: true,
  } satisfies AdminUserInsert);

  if (insertError) {
    console.error('Insert admin_user error:', insertError);
    return { success: false, error: `管理者登録に失敗しました: ${insertError.message}` };
  }

  return { success: true };
}

// トークンの有効性を検証（必要に応じて使用）
export async function validateToken(): Promise<boolean> {
  const token = await getAccessToken();
  if (!token) return false;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);

  if (error || !user) {
    // 無効なトークンの場合はクッキーを削除
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_TOKEN_COOKIE);
    return false;
  }

  return true;
}

