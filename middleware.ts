// Next.js Middleware
// 管理画面へのアクセスを認証で保護
// クッキーのアクセストークン有無で判別
// XSS対策: CSPヘッダーを追加

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 管理者認証用クッキー名
export const ADMIN_TOKEN_COOKIE = 'admin_access_token';
// 一般ユーザー認証用クッキー名
export const USER_TOKEN_COOKIE = 'user_access_token';
// MFA（2段階認証）完了前の一時トークン
export const MFA_PENDING_ACCESS_TOKEN_COOKIE = 'mfa_pending_access_token';

// ========================================
// XSS対策: セキュリティヘッダー
// ========================================

/**
 * CSPヘッダー値を生成
 * XSS攻撃の影響範囲を制限するためのContent Security Policy
 */
function getCSPHeader(): string {
  const directives = [
    // デフォルトは自サイトのみ
    "default-src 'self'",
    // スクリプトは自サイトのみ（Next.jsのインラインスクリプト用にunsafe-inlineが必要）
    // 'unsafe-eval' は開発モード用
    process.env.NODE_ENV === 'production'
      ? "script-src 'self' 'unsafe-inline'"
      : "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    // スタイルは自サイトのみ（インラインスタイル用）
    "style-src 'self' 'unsafe-inline'",
    // 画像は自サイト + data: URL（QRコード等）+ Supabase Storage
    "img-src 'self' data: blob: https://*.supabase.co",
    // フォントは自サイトのみ
    "font-src 'self'",
    // API接続は自サイト + Supabase
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    // フレームは禁止（クリックジャッキング対策）
    "frame-ancestors 'none'",
    // フォームの送信先は自サイトのみ
    "form-action 'self'",
    // base-uriは自サイトのみ
    "base-uri 'self'",
    // objectは禁止
    "object-src 'none'",
  ];

  return directives.join('; ');
}

/**
 * レスポンスにセキュリティヘッダーを追加
 */
function addSecurityHeaders(response: NextResponse): NextResponse {
  // Content Security Policy
  response.headers.set('Content-Security-Policy', getCSPHeader());
  // XSS保護（レガシーブラウザ用）
  response.headers.set('X-XSS-Protection', '1; mode=block');
  // MIMEタイプスニッフィング防止
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // クリックジャッキング対策
  response.headers.set('X-Frame-Options', 'DENY');
  // Referrer情報の制限
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // 権限ポリシー
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  return response;
}

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isDev = process.env.NODE_ENV !== 'production';
  const mfaPending = isDev ? undefined : request.cookies.get(MFA_PENDING_ACCESS_TOKEN_COOKIE)?.value;

  // /login は認証不要
  if (pathname === '/login') {
    // MFA途中ならMFA画面へ
    // 開発中はMFAをスキップするため、pendingがあっても /mfa へ飛ばさない
    const userToken = request.cookies.get(USER_TOKEN_COOKIE);
    const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE);
    if (adminToken?.value) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/admin', request.url)));
    }
    if (userToken?.value) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // /mfa はMFA途中のみアクセス可
  if (pathname === '/mfa') {
    // 開発中はMFA画面自体を使わない（戻して通常ログイン）
    if (isDev) {
      const res = NextResponse.redirect(new URL('/login', request.url));
      res.cookies.delete(MFA_PENDING_ACCESS_TOKEN_COOKIE);
      return addSecurityHeaders(res);
    }
    if (!mfaPending) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/login', request.url)));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // /admin/setup は認証不要（初期セットアップ）
  if (pathname === '/admin/setup') {
    // 既にログイン済みの場合はダッシュボードへリダイレクト
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE);
    if (token?.value) {
      return addSecurityHeaders(NextResponse.redirect(new URL('/admin', request.url)));
    }
    return addSecurityHeaders(NextResponse.next());
  }

  // MFA途中はアプリ本体へ入れない
  if (mfaPending && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    return addSecurityHeaders(NextResponse.redirect(new URL('/mfa', request.url)));
  }

  // /admin 以下のページは管理者トークンが必要
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE);

    // トークンがない場合はログインページへリダイレクト
    if (!token?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  // /dashboard はログイン必須（一般 or 管理者のどちらか）
  if (pathname.startsWith('/dashboard')) {
    const userToken = request.cookies.get(USER_TOKEN_COOKIE);
    const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE);
    if (!userToken?.value && !adminToken?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return addSecurityHeaders(NextResponse.redirect(loginUrl));
    }
  }

  // /predict は旧導線なので /dashboard へ（ログイン後に見せる）
  if (pathname === '/predict') {
    return addSecurityHeaders(NextResponse.redirect(new URL('/dashboard', request.url)));
  }

  return addSecurityHeaders(NextResponse.next());
}

export const config = {
  matcher: [
    '/admin/:path*',
    '/dashboard/:path*',
    '/mfa',
    '/login',
    '/predict',
  ],
};

