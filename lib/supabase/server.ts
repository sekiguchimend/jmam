// Supabase サーバーサイドクライアント
// Server Components と Server Actions 用
// クッキーベースのアクセストークン管理
// 注意: トークンのリフレッシュはミドルウェアで行うため、ここでは読み取りのみ

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { cache } from 'react';
import type { Database, AdminUser } from '@/types/database';
import { getUserIdFromJwt, decodeJwtPayload } from '@/lib/jwt';
import { createAuthedAnonServerClient } from './authed-anon-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// クッキー名
export const ADMIN_TOKEN_COOKIE = 'admin_access_token';
export const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';
export const USER_TOKEN_COOKIE = 'user_access_token';
export const USER_REFRESH_TOKEN_COOKIE = 'user_refresh_token';
export const MFA_PENDING_ACCESS_TOKEN_COOKIE = 'mfa_pending_access_token';
export const MFA_PENDING_REFRESH_TOKEN_COOKIE = 'mfa_pending_refresh_token';
export const MFA_PENDING_IS_ADMIN_COOKIE = 'mfa_pending_is_admin';
export const MFA_PENDING_REDIRECT_COOKIE = 'mfa_pending_redirect';

// ========================================
// Supabase クライアント
// ========================================

export async function createSupabaseServerClient() {
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll: () => [],
      setAll: () => {},
    },
  });
}

// ========================================
// トークン取得（読み取りのみ、リフレッシュはミドルウェア）
// ========================================

export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
}

export async function getUserAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(USER_TOKEN_COOKIE)?.value ?? null;
}

export async function getAnyAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  return cookieStore.get(ADMIN_TOKEN_COOKIE)?.value
    ?? cookieStore.get(USER_TOKEN_COOKIE)?.value
    ?? null;
}

// ========================================
// トークン存在チェック
// ========================================

export async function hasAccessToken(): Promise<boolean> {
  return !!(await getAccessToken());
}

export async function hasUserAccessToken(): Promise<boolean> {
  return !!(await getUserAccessToken());
}

export async function hasAnyAccessToken(): Promise<boolean> {
  return !!(await getAnyAccessToken());
}

// ========================================
// MFA Pending トークン
// ========================================

export async function getMfaPendingTokens(): Promise<{
  accessToken: string;
  refreshToken: string;
  isAdmin: boolean;
  redirectTo: string | null;
} | null> {
  const cookieStore = await cookies();
  const at = cookieStore.get(MFA_PENDING_ACCESS_TOKEN_COOKIE)?.value;
  const rt = cookieStore.get(MFA_PENDING_REFRESH_TOKEN_COOKIE)?.value;
  if (!at || !rt) return null;
  const isAdmin = cookieStore.get(MFA_PENDING_IS_ADMIN_COOKIE)?.value === '1';
  const redirectTo = cookieStore.get(MFA_PENDING_REDIRECT_COOKIE)?.value ?? null;
  return { accessToken: at, refreshToken: rt, isAdmin, redirectTo };
}

// ========================================
// ユーザー情報取得
// ========================================

export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) {
    console.error('getSession error:', error);
    return null;
  }
  return session;
}

export async function getUser() {
  const token = await getAccessToken();
  if (!token) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error('getUser error:', error);
    return null;
  }
  return user;
}

export async function getUserFromUserToken() {
  const token = await getUserAccessToken();
  if (!token) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error) {
    console.error('getUserFromUserToken error:', error);
    return null;
  }
  return user;
}

// ========================================
// 管理者関連
// ========================================

export async function isAdmin(): Promise<boolean> {
  return !!(await getAccessToken());
}

export async function getAdminUser(): Promise<AdminUser | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const supabase = await createSupabaseServerClient();
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return null;

  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !data) return null;
  return data as AdminUser;
}

// ========================================
// ユーザー情報と権限（キャッシュ付き）
// ========================================

export const getUserWithRole = cache(async (): Promise<{
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}> => {
  const cookieStore = await cookies();
  const adminToken = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  const userToken = cookieStore.get(USER_TOKEN_COOKIE)?.value;

  const token = adminToken ?? userToken;
  const isAdminUser = !!adminToken;

  if (!token) {
    return { id: '', email: '', name: 'ゲスト', isAdmin: false };
  }

  let id = '';
  let email = '';
  let fallbackName: string | null = null;

  try {
    const payload = decodeJwtPayload(token) ?? {};
    id = typeof payload.sub === 'string' ? payload.sub : '';
    email = typeof payload.email === 'string' ? payload.email : '';
    fallbackName = email ? email.split('@')[0] : null;
  } catch {
    return { id: '', email: '', name: isAdminUser ? '管理者' : 'ユーザー', isAdmin: isAdminUser };
  }

  if (!id) {
    return { id: '', email: '', name: isAdminUser ? '管理者' : 'ユーザー', isAdmin: isAdminUser };
  }

  try {
    const db = createAuthedAnonServerClient(token);
    const { data } = await db.from('profiles').select('email, name').eq('id', id).maybeSingle();
    const profile = data as { email: string | null; name: string | null } | null;

    if (profile) {
      return {
        id,
        email: profile.email ?? email,
        name: profile.name ?? fallbackName,
        isAdmin: isAdminUser,
      };
    }
  } catch (e) {
    console.error('getUserWithRole profile fetch error:', e);
  }

  return { id, email, name: fallbackName, isAdmin: isAdminUser };
});

// ========================================
// ユーティリティ
// ========================================

export async function getAuthedUserId(): Promise<string | null> {
  const token = await getAnyAccessToken();
  if (!token) return null;
  return getUserIdFromJwt(token);
}
