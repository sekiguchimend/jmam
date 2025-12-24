// Next.js Middleware
// 管理画面へのアクセスを認証で保護
// クッキーのアクセストークン有無で判別

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 管理者認証用クッキー名
export const ADMIN_TOKEN_COOKIE = 'admin_access_token';
// 一般ユーザー認証用クッキー名
export const USER_TOKEN_COOKIE = 'user_access_token';
// MFA（2段階認証）完了前の一時トークン
export const MFA_PENDING_ACCESS_TOKEN_COOKIE = 'mfa_pending_access_token';

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const mfaPending = request.cookies.get(MFA_PENDING_ACCESS_TOKEN_COOKIE)?.value;

  // /login は認証不要
  if (pathname === '/login') {
    // MFA途中ならMFA画面へ
    if (mfaPending) {
      return NextResponse.redirect(new URL('/mfa', request.url));
    }
    const userToken = request.cookies.get(USER_TOKEN_COOKIE);
    const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE);
    if (adminToken?.value) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    if (userToken?.value) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // /mfa はMFA途中のみアクセス可
  if (pathname === '/mfa') {
    if (!mfaPending) {
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return NextResponse.next();
  }

  // /admin/setup は認証不要（初期セットアップ）
  if (pathname === '/admin/setup') {
    // 既にログイン済みの場合はダッシュボードへリダイレクト
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE);
    if (token?.value) {
      return NextResponse.redirect(new URL('/admin', request.url));
    }
    return NextResponse.next();
  }

  // MFA途中はアプリ本体へ入れない
  if (mfaPending && (pathname.startsWith('/admin') || pathname.startsWith('/dashboard'))) {
    return NextResponse.redirect(new URL('/mfa', request.url));
  }

  // /admin 以下のページは管理者トークンが必要
  if (pathname.startsWith('/admin')) {
    const token = request.cookies.get(ADMIN_TOKEN_COOKIE);

    // トークンがない場合はログインページへリダイレクト
    if (!token?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // /dashboard はログイン必須（一般 or 管理者のどちらか）
  if (pathname.startsWith('/dashboard')) {
    const userToken = request.cookies.get(USER_TOKEN_COOKIE);
    const adminToken = request.cookies.get(ADMIN_TOKEN_COOKIE);
    if (!userToken?.value && !adminToken?.value) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // /predict は旧導線なので /dashboard へ（ログイン後に見せる）
  if (pathname === '/predict') {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  return NextResponse.next();
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

