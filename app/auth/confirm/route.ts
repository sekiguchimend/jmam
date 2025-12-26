import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import {
  ADMIN_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  MFA_PENDING_ACCESS_TOKEN_COOKIE,
  MFA_PENDING_REFRESH_TOKEN_COOKIE,
  MFA_PENDING_IS_ADMIN_COOKIE,
  MFA_PENDING_REDIRECT_COOKIE,
} from '@/lib/supabase/server';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import type { EmailOtpType } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tokenHash = url.searchParams.get('token_hash');
  const type = url.searchParams.get('type') ?? 'email';
  const redirectTo = url.searchParams.get('redirect') ?? url.searchParams.get('redirect_to');

  if (!tokenHash) {
    return NextResponse.redirect(new URL('/login', url));
  }

  const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });

  const otpType = (type as EmailOtpType) ?? 'email';
  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: otpType,
  });

  if (error || !data.session || !data.user) {
    return NextResponse.redirect(new URL('/login', url));
  }

  // 停止/消去/ブロックのユーザーはログイン不可
  try {
    const db = createAuthedAnonServerClient(data.session.access_token);
    const blocked = await db.from('user_blocks').select('user_id').eq('user_id', data.user.id).maybeSingle();
    if (blocked.data?.user_id) {
      return NextResponse.redirect(new URL('/login', url));
    }
    const profile = await db.from('profiles').select('status').eq('id', data.user.id).maybeSingle();
    const status = (profile.data as { status?: string } | null)?.status;
    if (!profile.data || (status && status !== 'active')) {
      return NextResponse.redirect(new URL('/login', url));
    }
  } catch {
    return NextResponse.redirect(new URL('/login', url));
  }

  // 管理者判定（admin_users）
  let isAdmin = false;
  try {
    const db = createAuthedAnonServerClient(data.session.access_token);
    const admin = await db
      .from('admin_users')
      .select('id')
      .eq('id', data.user.id)
      .eq('is_active', true)
      .maybeSingle();
    isAdmin = !!admin.data?.id;
  } catch {
    isAdmin = false;
  }

  // MFA必須：aal2になるまで本Cookieは発行しない
  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const currentLevel = aal.data?.currentLevel;

  const res = NextResponse.redirect(new URL(currentLevel === 'aal2' ? (isAdmin ? '/admin' : '/dashboard') : '/mfa', url));

  // 念のため古いcookieを削除
  res.cookies.delete(ADMIN_TOKEN_COOKIE);
  res.cookies.delete(USER_TOKEN_COOKIE);

  if (currentLevel !== 'aal2') {
    // pending cookieへ退避
    res.cookies.set(MFA_PENDING_ACCESS_TOKEN_COOKIE, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    res.cookies.set(MFA_PENDING_REFRESH_TOKEN_COOKIE, data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    res.cookies.set(MFA_PENDING_IS_ADMIN_COOKIE, isAdmin ? '1' : '0', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10,
      path: '/',
    });
    if (redirectTo) {
      res.cookies.set(MFA_PENDING_REDIRECT_COOKIE, redirectTo, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 10,
        path: '/',
      });
    } else {
      res.cookies.delete(MFA_PENDING_REDIRECT_COOKIE);
    }
    return res;
  }

  // aal2なら本Cookie発行
  res.cookies.set(USER_TOKEN_COOKIE, data.session.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  res.cookies.set(USER_REFRESH_TOKEN_COOKIE, data.session.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7,
    path: '/',
  });
  if (isAdmin) {
    res.cookies.set(ADMIN_TOKEN_COOKIE, data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
    res.cookies.set(ADMIN_REFRESH_TOKEN_COOKIE, data.session.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }

  return res;
}


