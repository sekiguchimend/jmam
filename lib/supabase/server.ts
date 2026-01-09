// Supabase サーバーサイドクライアント
// Server Components と Server Actions 用
// クッキーベースのアクセストークン管理

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database, AdminUser } from '@/types/database';
import { getUserIdFromJwt, decodeJwtPayload } from '@/lib/jwt';
import { createAuthedAnonServerClient } from './authed-anon-server';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// 管理者認証用クッキー名
export const ADMIN_TOKEN_COOKIE = 'admin_access_token';
export const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';
// 一般ユーザー認証用クッキー名
export const USER_TOKEN_COOKIE = 'user_access_token';
export const USER_REFRESH_TOKEN_COOKIE = 'user_refresh_token';

// MFA（2段階認証）完了前の一時トークン
export const MFA_PENDING_ACCESS_TOKEN_COOKIE = 'mfa_pending_access_token';
export const MFA_PENDING_REFRESH_TOKEN_COOKIE = 'mfa_pending_refresh_token';
export const MFA_PENDING_IS_ADMIN_COOKIE = 'mfa_pending_is_admin';
export const MFA_PENDING_REDIRECT_COOKIE = 'mfa_pending_redirect';

// refresh連打を避けるためのバックオフ（短時間）
const ADMIN_REFRESH_BACKOFF_UNTIL_COOKIE = 'admin_refresh_backoff_until';
const USER_REFRESH_BACKOFF_UNTIL_COOKIE = 'user_refresh_backoff_until';

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

function parseSec(v: string | undefined): number | null {
  if (!v) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function isOverRequestRateLimit(error: unknown): boolean {
  const e = error as { status?: number; code?: string } | null;
  return !!e && (e.status === 429 || e.code === 'over_request_rate_limit');
}

async function canWriteCookies(cookieStore: Awaited<ReturnType<typeof cookies>>): Promise<boolean> {
  try {
    // Server Componentでは set が例外になるので判定用に軽い書き込みを試す
    cookieStore.set('__sb_cookie_write_probe', '1', { path: '/', maxAge: 1 });
    cookieStore.delete('__sb_cookie_write_probe');
    return true;
  } catch {
    return false;
  }
}

// リフレッシュトークンを使って新しいセッションを取得
// IMPORTANT: キャッシュは使わない（リフレッシュごとに新しいトークンが発行されるため）
async function refreshSession(refreshToken: string) {
  // Supabase Auth APIを直接呼び出す（クッキーに依存しない）
  const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': supabaseAnonKey,
    },
    body: JSON.stringify({
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const error = await response.json();
    return { data: { session: null }, error };
  }

  const data = await response.json();
  return {
    data: {
      session: {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        expires_in: data.expires_in,
        expires_at: data.expires_at,
        token_type: data.token_type,
        user: data.user,
      },
    },
    error: null,
  };
}

// Server Components用のSupabaseクライアントを作成
// IMPORTANT: Supabase SSRのデフォルトのクッキー管理を無効化し、手動管理のみを使用
export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        // Supabase SSRのデフォルトクッキーは無視し、空配列を返す
        // これにより、Supabaseは自動的にクッキーを読み書きしない
        return [];
      },
      setAll(cookiesToSet: { name: string; value: string; options?: Record<string, unknown> }[]) {
        // Supabase SSRの自動クッキー書き込みを無効化
        // 手動で管理するクッキーのみを使用
        // no-op
      },
    },
  });
}

// クッキーからアクセストークンを取得（期限切れなら自動更新）
export async function getAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;
  if (!token) return null;

  // トークンが期限切れかチェック
  const { isJwtExpired, decodeJwtPayload } = await import('@/lib/jwt');
  if (!isJwtExpired(token)) {
    return token;
  }

  const writable = await canWriteCookies(cookieStore);

  // 直近でレート制限になった場合は一定時間refreshしない
  const backoffUntil = parseSec(cookieStore.get(ADMIN_REFRESH_BACKOFF_UNTIL_COOKIE)?.value);
  if (backoffUntil && nowSec() < backoffUntil) {
    return writable ? null : token;
  }

  // 期限切れならリフレッシュを試みる
  const refreshToken = cookieStore.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  const { data, error } = await refreshSession(refreshToken);

  if (error || !data.session) {
    console.error('Admin token refresh failed:', {
      error: error?.message,
      status: (error as any)?.status,
      code: (error as any)?.code,
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length,
    });
    if (isOverRequestRateLimit(error)) {
      if (writable) {
        try {
        cookieStore.set(ADMIN_REFRESH_BACKOFF_UNTIL_COOKIE, String(nowSec() + 60), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60,
          path: '/',
        });
        } catch {
          // no-op
        }
      }
      // レート制限中に権限が落ちないよう、既存（期限切れの）トークンを返す
      return token;
    }
    // リフレッシュ失敗時はクッキーを削除
    if (writable) {
      try {
        cookieStore.delete(ADMIN_TOKEN_COOKIE);
        cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);
      } catch {
        // no-op
      }
    }
    return null;
  }

  // 新しいトークンをクッキーに保存
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
  const commonCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };

  if (writable) {
    try {
    cookieStore.set(ADMIN_TOKEN_COOKIE, data.session.access_token, commonCookie);
    cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
    // user_access_token も同時に更新
    cookieStore.set(USER_TOKEN_COOKIE, data.session.access_token, commonCookie);
    cookieStore.set(USER_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
    cookieStore.delete(ADMIN_REFRESH_BACKOFF_UNTIL_COOKIE);
    cookieStore.delete(USER_REFRESH_BACKOFF_UNTIL_COOKIE);
    } catch {
      // no-op
    }
  }

  return data.session.access_token;
}

// クッキーから一般ユーザーのアクセストークンを取得（期限切れなら自動更新）
export async function getUserAccessToken(): Promise<string | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_TOKEN_COOKIE)?.value;
  if (!token) return null;

  // トークンが期限切れかチェック
  const { isJwtExpired, decodeJwtPayload } = await import('@/lib/jwt');
  if (!isJwtExpired(token)) {
    return token;
  }

  const writable = await canWriteCookies(cookieStore);

  // 直近でレート制限になった場合は一定時間refreshしない
  const backoffUntil = parseSec(cookieStore.get(USER_REFRESH_BACKOFF_UNTIL_COOKIE)?.value);
  if (backoffUntil && nowSec() < backoffUntil) {
    return writable ? null : token;
  }

  // 期限切れならリフレッシュを試みる
  const refreshToken = cookieStore.get(USER_REFRESH_TOKEN_COOKIE)?.value;
  if (!refreshToken) {
    return null;
  }

  const { data, error } = await refreshSession(refreshToken);

  if (error || !data.session) {
    console.error('User token refresh failed:', {
      error: error?.message,
      status: (error as any)?.status,
      code: (error as any)?.code,
      hasRefreshToken: !!refreshToken,
      refreshTokenLength: refreshToken?.length,
    });
    if (isOverRequestRateLimit(error)) {
      if (writable) {
        try {
        cookieStore.set(USER_REFRESH_BACKOFF_UNTIL_COOKIE, String(nowSec() + 60), {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60,
          path: '/',
        });
        } catch {
          // no-op
        }
      }
      // レート制限中にログイン状態が落ちないよう、既存（期限切れの）トークンを返す
      return token;
    }
    // リフレッシュ失敗時はクッキーを削除
    if (writable) {
      try {
        cookieStore.delete(USER_TOKEN_COOKIE);
        cookieStore.delete(USER_REFRESH_TOKEN_COOKIE);
      } catch {
        // no-op
      }
    }
    return null;
  }

  // 新しいトークンをクッキーに保存
  const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;
  const commonCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };

  if (writable) {
    try {
    cookieStore.set(USER_TOKEN_COOKIE, data.session.access_token, commonCookie);
    cookieStore.set(USER_REFRESH_TOKEN_COOKIE, data.session.refresh_token, commonCookie);
    cookieStore.delete(USER_REFRESH_BACKOFF_UNTIL_COOKIE);
    } catch {
      // no-op
    }
  }

  return data.session.access_token;
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
  // 管理者判定：クッキーが存在するかで判定するが、トークンは必ずgetAccessToken()経由で取得してリフレッシュを確実に行う
  const cookieStore = await cookies();
  const adminTokenCookie = cookieStore.get(ADMIN_TOKEN_COOKIE)?.value ?? null;
  const hasAdminCookie = !!adminTokenCookie;

  // トークンを取得（期限切れなら自動リフレッシュされる）
  let token: string | null = null;
  let isAdmin = false;

  if (hasAdminCookie) {
    // 管理者クッキーがある場合、getAccessToken()を呼んでリフレッシュを試みる
    token = await getAccessToken();
    // リフレッシュ成功した場合のみ管理者扱い
    isAdmin = !!token;
  }

  // 管理者トークンがない場合、一般ユーザートークンを試す
  if (!token) {
    token = await getUserAccessToken();
    isAdmin = false;
  }

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
    return { id: '', email: '', name: isAdmin ? '管理者' : 'ユーザー', isAdmin };
  }

  if (!id) {
    return { id: '', email: '', name: isAdmin ? '管理者' : 'ユーザー', isAdmin };
  }

  try {
    // RLSのauth.uid()を効かせるため、anon + Authorization(JWT) で profiles を参照する
    const db = createAuthedAnonServerClient(token);
    const { data } = await db.from('profiles').select('email, name').eq('id', id).maybeSingle();
    const profile = data as { email: string | null; name: string | null } | null;

    if (profile) {
      return {
        id,
        email: profile.email ?? email,
        name: profile.name ?? fallbackName,
        isAdmin,
      };
    }
  } catch (e) {
    console.error('getUserWithRole profile fetch error:', e);
  }

  return { id, email, name: fallbackName, isAdmin };
}

// クッキーに入っている admin/user いずれかのJWTからユーザーIDを取得
export async function getAuthedUserId(): Promise<string | null> {
  const token = await getAnyAccessToken();
  if (!token) return null;
  return getUserIdFromJwt(token);
}

