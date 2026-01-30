// MFA（TOTP）必須化のためのServer Actions

'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/types/database';
import {
  MFA_PENDING_ACCESS_TOKEN_COOKIE,
  MFA_PENDING_REFRESH_TOKEN_COOKIE,
  MFA_PENDING_IS_ADMIN_COOKIE,
  MFA_PENDING_REDIRECT_COOKIE,
  ADMIN_TOKEN_COOKIE,
  ADMIN_REFRESH_TOKEN_COOKIE,
  USER_TOKEN_COOKIE,
  USER_REFRESH_TOKEN_COOKIE,
  getMfaPendingTokens,
} from '@/lib/supabase/server';
import { getSafeRedirectUrl } from '@/lib/security';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// クッキーの有効期限（MFA途中は短め）
const PENDING_COOKIE_MAX_AGE = 60 * 10; // 10分
const FINAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7日

function createAnonClient() {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

async function getClientWithPendingSession() {
  const pending = await getMfaPendingTokens();
  if (!pending) return null;
  const supabase = createAnonClient();
  const { error } = await supabase.auth.setSession({
    access_token: pending.accessToken,
    refresh_token: pending.refreshToken,
  });
  if (error) {
    console.error('MFA setSession error:', error);
    return null;
  }
  return { supabase, pending };
}

export async function getMfaStatus(): Promise<
  | { ok: false; error: string }
  | {
      ok: true;
      email: string;
      mode: 'needsEnroll' | 'needsVerify';
      factorId?: string;
      redirectTo: string | null;
    }
> {
  const ctx = await getClientWithPendingSession();
  if (!ctx) return { ok: false, error: 'MFAセッションが見つかりません。再ログインしてください。' };

  const { supabase, pending } = ctx;
  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData.user?.email) {
    return { ok: false, error: 'ユーザー情報の取得に失敗しました。再ログインしてください。' };
  }

  const { data: factors, error: factorsErr } = await supabase.auth.mfa.listFactors();
  if (factorsErr) {
    console.error('mfa.listFactors error:', factorsErr);
    return { ok: false, error: 'MFA情報の取得に失敗しました。' };
  }

  const verifiedTotp = factors.totp?.find((f) => f.status === 'verified') ?? null;
  if (verifiedTotp) {
    return {
      ok: true,
      email: userData.user.email,
      mode: 'needsVerify',
      factorId: verifiedTotp.id,
      redirectTo: pending.redirectTo,
    };
  }

  return { ok: true, email: userData.user.email, mode: 'needsEnroll', redirectTo: pending.redirectTo };
}

export async function startTotpEnroll(): Promise<
  | { ok: false; error: string }
  | { ok: true; factorId: string; qrCode: string; secret: string }
> {
  const ctx = await getClientWithPendingSession();
  if (!ctx) return { ok: false, error: 'MFAセッションが見つかりません。再ログインしてください。' };
  const { supabase } = ctx;

  const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });
  if (error) {
    console.error('mfa.enroll error:', error);
    return { ok: false, error: 'MFAの登録開始に失敗しました。' };
  }

  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyTotp(params: { factorId: string; code: string }): Promise<
  | { ok: false; error: string }
  | { ok: true; redirectTo: string }
> {
  const ctx = await getClientWithPendingSession();
  if (!ctx) return { ok: false, error: 'MFAセッションが見つかりません。再ログインしてください。' };
  const { supabase, pending } = ctx;

  const factorId = params.factorId;
  const code = params.code.trim();
  if (!factorId || !code) return { ok: false, error: '認証コードを入力してください。' };

  const challenge = await supabase.auth.mfa.challenge({ factorId });
  if (challenge.error) {
    console.error('mfa.challenge error:', challenge.error);
    return { ok: false, error: '認証コードの検証準備に失敗しました。' };
  }

  const verify = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.data.id,
    code,
  });
  if (verify.error) {
    return { ok: false, error: verify.error.message };
  }

  const aal = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal.error) {
    console.error('mfa.getAuthenticatorAssuranceLevel error:', aal.error);
    return { ok: false, error: 'MFA状態の確認に失敗しました。' };
  }
  if (aal.data.currentLevel !== 'aal2') {
    return { ok: false, error: 'MFAの検証が完了していません。もう一度お試しください。' };
  }

  const session = (await supabase.auth.getSession()).data.session;
  if (!session?.access_token) {
    return { ok: false, error: 'セッションの確定に失敗しました。再ログインしてください。' };
  }

  // 停止/消去/ブロックなら完了させない
  try {
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return { ok: false, error: 'ユーザー情報の取得に失敗しました。' };

    const db = createAnonClient();
    // mfa検証後のaccess_tokenでRLSを効かせる
    await db.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token! });

    const blocked = await db.from('user_blocks').select('user_id').eq('user_id', userId).maybeSingle();
    if (blocked.data?.user_id) {
      return { ok: false, error: 'このアカウントは利用できません（消去済み）' };
    }
    const profile = await db.from('profiles').select('status').eq('id', userId).maybeSingle();
    if (!profile.data) {
      return { ok: false, error: 'このアカウントは利用できません' };
    }
    const status = (profile.data as { status?: string } | null)?.status;
    if (status && status !== 'active') {
      return { ok: false, error: status === 'suspended' ? 'このアカウントは停止中です' : 'このアカウントは利用できません' };
    }
  } catch (e) {
    console.error('verifyTotp status check error:', e);
    return { ok: false, error: 'ログイン状態の確認に失敗しました。' };
  }

  // 最終ログインCookieを発行（ここで初めてアプリへ入れる）
  const cookieStore = await cookies();

  // 古いSupabase SSRのデフォルトクッキーを削除（sb-で始まるもの）
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name);
    }
  }

  const commonCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: FINAL_COOKIE_MAX_AGE,
    path: '/',
  };

  cookieStore.set(USER_TOKEN_COOKIE, session.access_token, commonCookie);
  cookieStore.set(USER_REFRESH_TOKEN_COOKIE, session.refresh_token!, commonCookie);
  if (pending.isAdmin) {
    cookieStore.set(ADMIN_TOKEN_COOKIE, session.access_token, commonCookie);
    cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, session.refresh_token!, commonCookie);
  } else {
    cookieStore.delete(ADMIN_TOKEN_COOKIE);
    cookieStore.delete(ADMIN_REFRESH_TOKEN_COOKIE);
  }

  // pendingを削除
  cookieStore.delete(MFA_PENDING_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(MFA_PENDING_REFRESH_TOKEN_COOKIE);
  cookieStore.delete(MFA_PENDING_IS_ADMIN_COOKIE);
  cookieStore.delete(MFA_PENDING_REDIRECT_COOKIE);

  // XSS/Open Redirect対策: リダイレクト先を検証
  const redirectTo = getSafeRedirectUrl(pending.redirectTo, pending.isAdmin);
  return { ok: true, redirectTo };
}

export async function cancelMfa(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(MFA_PENDING_ACCESS_TOKEN_COOKIE);
  cookieStore.delete(MFA_PENDING_REFRESH_TOKEN_COOKIE);
  cookieStore.delete(MFA_PENDING_IS_ADMIN_COOKIE);
  cookieStore.delete(MFA_PENDING_REDIRECT_COOKIE);
}

// login action から呼ぶ：MFA未完了の一時トークンを保存
export async function setMfaPendingCookies(params: {
  accessToken: string;
  refreshToken: string;
  isAdmin: boolean;
  redirectTo: string | null;
}): Promise<void> {
  const cookieStore = await cookies();
  const commonCookie = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: PENDING_COOKIE_MAX_AGE,
    path: '/',
  };
  cookieStore.set(MFA_PENDING_ACCESS_TOKEN_COOKIE, params.accessToken, commonCookie);
  cookieStore.set(MFA_PENDING_REFRESH_TOKEN_COOKIE, params.refreshToken, commonCookie);
  cookieStore.set(MFA_PENDING_IS_ADMIN_COOKIE, params.isAdmin ? '1' : '0', commonCookie);
  if (params.redirectTo) {
    cookieStore.set(MFA_PENDING_REDIRECT_COOKIE, params.redirectTo, commonCookie);
  } else {
    cookieStore.delete(MFA_PENDING_REDIRECT_COOKIE);
  }
}


