// Next.js Middleware
// 認証・認可・セキュリティの一元管理

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// ========================================
// 定数
// ========================================

const ADMIN_TOKEN_COOKIE = 'admin_access_token';
const ADMIN_REFRESH_TOKEN_COOKIE = 'admin_refresh_token';
const USER_TOKEN_COOKIE = 'user_access_token';
const USER_REFRESH_TOKEN_COOKIE = 'user_refresh_token';
const MFA_PENDING_ACCESS_TOKEN_COOKIE = 'mfa_pending_access_token';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7;

// ========================================
// JWT（ローカル処理のみ）
// ========================================

function checkToken(token: string | undefined): { valid: boolean; expired: boolean } {
  if (!token) return { valid: false, expired: false };
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return { valid: false, expired: false };
    const payload = JSON.parse(atob(parts[1]));
    const exp = payload.exp;
    if (!exp) return { valid: false, expired: false };
    const now = Math.floor(Date.now() / 1000);
    if (now < exp) return { valid: true, expired: false };
    return { valid: false, expired: true };
  } catch {
    return { valid: false, expired: false };
  }
}

// ========================================
// トークンリフレッシュ（期限切れ時のみ）
// ========================================

async function refreshTokens(refreshToken: string): Promise<{
  success: boolean;
  accessToken?: string;
  refreshToken?: string;
}> {
  try {
    const res = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': supabaseAnonKey },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok) return { success: false };
    const data = await res.json();
    if (!data.access_token || !data.refresh_token) return { success: false };
    return { success: true, accessToken: data.access_token, refreshToken: data.refresh_token };
  } catch {
    return { success: false };
  }
}

// ========================================
// セキュリティヘッダー
// ========================================

const CSP_PROD = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://*.supabase.co",
  "font-src 'self'",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "frame-ancestors 'none'",
  "form-action 'self'",
  "base-uri 'self'",
  "object-src 'none'",
].join('; ');

const CSP_DEV = CSP_PROD.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'");

function addSecurityHeaders(res: NextResponse, isDev: boolean): NextResponse {
  res.headers.set('Content-Security-Policy', isDev ? CSP_DEV : CSP_PROD);
  res.headers.set('X-Content-Type-Options', 'nosniff');
  res.headers.set('X-Frame-Options', 'DENY');
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  return res;
}

// ========================================
// クッキー操作
// ========================================

function setTokenCookies(res: NextResponse, accessToken: string, refreshToken: string, isAdmin: boolean): void {
  const opts = { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax' as const, maxAge: COOKIE_MAX_AGE, path: '/' };
  res.cookies.set(USER_TOKEN_COOKIE, accessToken, opts);
  res.cookies.set(USER_REFRESH_TOKEN_COOKIE, refreshToken, opts);
  if (isAdmin) {
    res.cookies.set(ADMIN_TOKEN_COOKIE, accessToken, opts);
    res.cookies.set(ADMIN_REFRESH_TOKEN_COOKIE, refreshToken, opts);
  }
}

function clearAllCookies(res: NextResponse): void {
  res.cookies.delete(ADMIN_TOKEN_COOKIE);
  res.cookies.delete(ADMIN_REFRESH_TOKEN_COOKIE);
  res.cookies.delete(USER_TOKEN_COOKIE);
  res.cookies.delete(USER_REFRESH_TOKEN_COOKIE);
}

// ========================================
// リダイレクト
// ========================================

function redirectToLogin(req: NextRequest, pathname: string, isDev: boolean): NextResponse {
  const url = new URL('/login', req.url);
  if (pathname !== '/login' && pathname !== '/') url.searchParams.set('redirect', pathname);
  const res = NextResponse.redirect(url);
  clearAllCookies(res);
  return addSecurityHeaders(res, isDev);
}

// ========================================
// メイン
// ========================================

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isDev = process.env.NODE_ENV !== 'production';

  // ------------------------------------------
  // Prefetch リクエストは軽量処理
  // ------------------------------------------
  const isPrefetch = req.headers.get('purpose') === 'prefetch' || req.headers.get('x-middleware-prefetch') === '1';

  // ------------------------------------------
  // トークン取得（1回だけ）
  // ------------------------------------------
  const adminToken = req.cookies.get(ADMIN_TOKEN_COOKIE)?.value;
  const adminRefresh = req.cookies.get(ADMIN_REFRESH_TOKEN_COOKIE)?.value;
  const userToken = req.cookies.get(USER_TOKEN_COOKIE)?.value;
  const userRefresh = req.cookies.get(USER_REFRESH_TOKEN_COOKIE)?.value;
  const mfaPending = isDev ? undefined : req.cookies.get(MFA_PENDING_ACCESS_TOKEN_COOKIE)?.value;

  const adminStatus = checkToken(adminToken);
  const userStatus = checkToken(userToken);

  // ------------------------------------------
  // API ルート保護 (/api/admin/*)
  // ------------------------------------------
  if (pathname.startsWith('/api/admin')) {
    if (!adminStatus.valid) {
      // 期限切れならリフレッシュ試行
      if (adminStatus.expired && adminRefresh && !isPrefetch) {
        const result = await refreshTokens(adminRefresh);
        if (result.success && result.accessToken && result.refreshToken) {
          const res = NextResponse.next();
          setTokenCookies(res, result.accessToken, result.refreshToken, true);
          return res;
        }
      }
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.next();
  }

  // ------------------------------------------
  // /login
  // ------------------------------------------
  if (pathname === '/login') {
    if (adminStatus.valid) return addSecurityHeaders(NextResponse.redirect(new URL('/admin', req.url)), isDev);
    if (userStatus.valid) return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)), isDev);
    if (adminToken || userToken) {
      const res = NextResponse.next();
      clearAllCookies(res);
      return addSecurityHeaders(res, isDev);
    }
    return addSecurityHeaders(NextResponse.next(), isDev);
  }

  // ------------------------------------------
  // /mfa
  // ------------------------------------------
  if (pathname === '/mfa') {
    if (isDev) {
      const res = NextResponse.redirect(new URL('/login', req.url));
      res.cookies.delete(MFA_PENDING_ACCESS_TOKEN_COOKIE);
      return addSecurityHeaders(res, isDev);
    }
    if (!mfaPending) return addSecurityHeaders(NextResponse.redirect(new URL('/login', req.url)), isDev);
    return addSecurityHeaders(NextResponse.next(), isDev);
  }

  // ------------------------------------------
  // /admin/setup
  // ------------------------------------------
  if (pathname === '/admin/setup') {
    if (adminStatus.valid) return addSecurityHeaders(NextResponse.redirect(new URL('/admin', req.url)), isDev);
    return addSecurityHeaders(NextResponse.next(), isDev);
  }

  // ------------------------------------------
  // MFA途中はアプリ入れない
  // ------------------------------------------
  if (mfaPending && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/mfa', req.url)), isDev);
  }

  // ------------------------------------------
  // /admin/*
  // ------------------------------------------
  if (pathname.startsWith('/admin')) {
    if (adminStatus.valid) return addSecurityHeaders(NextResponse.next(), isDev);
    if (adminStatus.expired && adminRefresh && !isPrefetch) {
      const result = await refreshTokens(adminRefresh);
      if (result.success && result.accessToken && result.refreshToken) {
        const res = NextResponse.next();
        setTokenCookies(res, result.accessToken, result.refreshToken, true);
        return addSecurityHeaders(res, isDev);
      }
    }
    return redirectToLogin(req, pathname, isDev);
  }

  // ------------------------------------------
  // /dashboard/*
  // ------------------------------------------
  if (pathname.startsWith('/dashboard')) {
    if (adminStatus.valid || userStatus.valid) return addSecurityHeaders(NextResponse.next(), isDev);

    // 管理者リフレッシュ
    if (adminStatus.expired && adminRefresh && !isPrefetch) {
      const result = await refreshTokens(adminRefresh);
      if (result.success && result.accessToken && result.refreshToken) {
        const res = NextResponse.next();
        setTokenCookies(res, result.accessToken, result.refreshToken, true);
        return addSecurityHeaders(res, isDev);
      }
    }

    // ユーザーリフレッシュ
    if (userStatus.expired && userRefresh && !isPrefetch) {
      const result = await refreshTokens(userRefresh);
      if (result.success && result.accessToken && result.refreshToken) {
        const res = NextResponse.next();
        setTokenCookies(res, result.accessToken, result.refreshToken, false);
        return addSecurityHeaders(res, isDev);
      }
    }

    return redirectToLogin(req, pathname, isDev);
  }

  // ------------------------------------------
  // /predict (旧導線)
  // ------------------------------------------
  if (pathname === '/predict') {
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', req.url)), isDev);
  }

  return addSecurityHeaders(NextResponse.next(), isDev);
}

// ========================================
// マッチャー
// ========================================

export const config = {
  matcher: [
    // ページ
    '/admin/:path*',
    '/dashboard/:path*',
    '/mfa',
    '/login',
    '/predict',
    // API（/api/admin/uploadは大きなファイルを扱うため除外）
    '/api/admin/((?!upload).)*',
  ],
};
