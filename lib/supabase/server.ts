// Supabase サーバーサイドクライアント
// Server Components と Server Actions 用
// クッキーベースのアクセストークン管理

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database, AdminUser } from '@/types/database';
import { getUserIdFromJwt, decodeJwtPayload } from '@/lib/jwt';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 管理者認証用クッキー名
export const ADMIN_TOKEN_COOKIE = 'admin_access_token';
// 一般ユーザー認証用クッキー名
export const USER_TOKEN_COOKIE = 'user_access_token';

// MFA（2段階認証）完了前の一時トークン
export const MFA_PENDING_ACCESS_TOKEN_COOKIE = 'mfa_pending_access_token';
export const MFA_PENDING_REFRESH_TOKEN_COOKIE = 'mfa_pending_refresh_token';
export const MFA_PENDING_IS_ADMIN_COOKIE = 'mfa_pending_is_admin';
export const MFA_PENDING_REDIRECT_COOKIE = 'mfa_pending_redirect';

// Server Components用のSupabaseクライアントを作成
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        } catch {
          // Server Componentからの呼び出し時は無視
        }
      },
    },
  });
}

// クッキーからアクセストークンを取得
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE);
  return token?.value ?? null;
}

// クッキーから一般ユーザーのアクセストークンを取得
export async function getUserAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_TOKEN_COOKIE);
  return token?.value ?? null;
}

// admin/user のいずれかのアクセストークンを取得（存在する方）
export async function getAnyAccessToken(): Promise<string | null> {
  return (await getAccessToken()) || (await getUserAccessToken());
}

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

// 管理者アクセストークンがあるかどうか確認
export async function hasAccessToken(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

// 一般ユーザーのアクセストークンがあるかどうか確認
export async function hasUserAccessToken(): Promise<boolean> {
  const token = await getUserAccessToken();
  return !!token;
}

// いずれかのアクセストークンがあるかどうか確認（ダッシュボード用）
export async function hasAnyAccessToken(): Promise<boolean> {
  const adminToken = await getAccessToken();
  const userToken = await getUserAccessToken();
  return !!(adminToken || userToken);
}

// 現在のセッションを取得
export async function getSession() {
  const supabase = await createSupabaseServerClient();
  const { data: { session }, error } = await supabase.auth.getSession();
  
  if (error) {
    console.error('getSession error:', error);
    return null;
  }
  
  return session;
}

// 現在のユーザーを取得（トークンを使用）
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

// 現在のユーザーを取得（一般ユーザートークンを使用）
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

// 管理者かどうかを確認（クッキーベース）
// ミドルウェアで admin_access_token の存在をチェック済みなので、
// ここではクッキーの有無のみで判断（API呼び出しを削減）
export async function isAdmin(): Promise<boolean> {
  const token = await getAccessToken();
  return !!token;
}

// 管理者情報を取得
export async function getAdminUser(): Promise<AdminUser | null> {
  const token = await getAccessToken();
  if (!token) return null;

  const supabase = await createSupabaseServerClient();

  // トークンからユーザー情報を取得
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return null;

  // admin_usersテーブルから管理者情報を取得
  const { data, error } = await supabase
    .from('admin_users')
    .select('*')
    .eq('id', user.id)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return null;
  }

  return data as AdminUser;
}

// ユーザー情報と権限を取得（管理者・一般ユーザー両方対応）
// ミドルウェアで認証済みなので、クッキーベースで判断
export async function getUserWithRole(): Promise<{
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
}> {
  // 管理者トークンがあれば管理者（ミドルウェアで検証済み）
  const adminToken = await getAccessToken();
  const isAdmin = !!adminToken;

  // ユーザー情報はJWTから取得を試みる（API呼び出しを避ける）
  const token = adminToken || (await getUserAccessToken());

  if (!token) {
    // トークンがない場合はデフォルト値を返す
    return {
      id: '',
      email: '',
      name: 'ゲスト',
      isAdmin: false,
    };
  }

  // JWTをデコードしてユーザー情報を取得（API呼び出しなし）
  try {
    const payload = decodeJwtPayload(token) ?? {};
    return {
      id: typeof payload.sub === 'string' ? payload.sub : '',
      email: typeof payload.email === 'string' ? payload.email : '',
      name: typeof payload.email === 'string' ? payload.email.split('@')[0] : null,
      isAdmin,
    };
  } catch {
    // デコード失敗時はデフォルト値
    return {
      id: '',
      email: '',
      name: isAdmin ? '管理者' : 'ユーザー',
      isAdmin,
    };
  }
}

// クッキーに入っている admin/user いずれかのJWTからユーザーIDを取得
export async function getAuthedUserId(): Promise<string | null> {
  const token = await getAnyAccessToken();
  if (!token) return null;
  return getUserIdFromJwt(token);
}

