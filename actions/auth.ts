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
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { setMfaPendingCookies } from '@/actions/mfa';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { headers } from 'next/headers';
import type { AuthError } from '@supabase/supabase-js';
import { getSafeRedirectUrl } from '@/lib/security';

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

    // 古いSupabase SSRのデフォルトクッキーも削除（sb-で始まるもの）
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

    // XSS/Open Redirect対策: リダイレクト先を検証
    const resolvedRedirect = getSafeRedirectUrl(redirectTo, isAdmin);
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
    // XSS/Open Redirect対策: リダイレクト先を検証
    await setMfaPendingCookies({
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      isAdmin,
      redirectTo: getSafeRedirectUrl(redirectTo, isAdmin),
    });

    // 既存ログインCookieを念のため削除
    const cookieStore = await cookies();
    cookieStore.delete(ADMIN_TOKEN_COOKIE);
    cookieStore.delete(USER_TOKEN_COOKIE);

    return { success: true, redirectTo: '/mfa' };
  }

  // アクセストークンをクッキーに保存
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

  // XSS/Open Redirect対策: リダイレクト先を検証
  const resolvedRedirect = getSafeRedirectUrl(redirectTo, isAdmin);
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

  // Supabase SSRのデフォルトクッキーも削除（sb-で始まるもの）
  const allCookies = cookieStore.getAll();
  for (const cookie of allCookies) {
    if (cookie.name.startsWith('sb-')) {
      cookieStore.delete(cookie.name);
    }
  }

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
  // @ts-expect-error - Supabase SSR type inference issue with Database generics
  const { error: insertError } = await supabase.from('admin_users').insert({
    id: data.user.id,
    email,
    name: name || null,
    role: 'admin',
    is_active: true,
  });

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

// パスワード変更（メール送信なし、MFA対応）
export async function changePassword(
  currentPassword: string,
  newPassword: string,
  totpCode?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // バリデーション
  if (!currentPassword) {
    return { success: false, error: '現在のパスワードを入力してください' };
  }
  if (!newPassword) {
    return { success: false, error: '新しいパスワードを入力してください' };
  }
  if (newPassword.length < 8) {
    return { success: false, error: '新しいパスワードは8文字以上で入力してください' };
  }
  if (currentPassword === newPassword) {
    return { success: false, error: '新しいパスワードは現在のパスワードと異なるものを入力してください' };
  }

  // 開発環境チェック
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const skipMfa = isDevMfaBypass(host);

  // 本番環境ではTOTPコード必須
  if (!skipMfa && (!totpCode || totpCode.trim().length !== 6)) {
    return { success: false, error: '認証コード（6桁）を入力してください' };
  }

  // 現在のトークンからユーザー情報を取得
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_TOKEN_COOKIE)?.value ?? cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;

  if (!token) {
    return { success: false, error: 'ログインセッションが見つかりません。再度ログインしてください。' };
  }

  const supabase = await createSupabaseServerClient();

  // トークンからユーザー情報を取得
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user || !user.email) {
    return { success: false, error: 'ユーザー情報の取得に失敗しました。再度ログインしてください。' };
  }

  // 現在のパスワードで再認証（本人確認）
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError || !signInData.session) {
    return { success: false, error: '現在のパスワードが正しくありません' };
  }

  // セッションを設定
  await supabase.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  // 開発環境ではAdmin APIを使ってMFAをバイパス
  if (skipMfa) {
    // service_roleキーを使ってAdmin APIでパスワード更新
    const { createClient } = await import('@supabase/supabase-js');
    const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    const { error: adminUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
      user.id,
      { password: newPassword }
    );

    if (adminUpdateError) {
      console.error('admin.updateUserById error:', adminUpdateError);
      return { success: false, error: 'パスワードの変更に失敗しました' };
    }
  } else {
    // 本番環境: MFA認証を行う
    // MFA: factorIdを取得
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      console.error('mfa.listFactors error:', factorsError);
      return { success: false, error: 'MFA情報の取得に失敗しました' };
    }

    const verifiedTotp = factors.totp?.find((f) => f.status === 'verified');
    if (!verifiedTotp) {
      return { success: false, error: 'MFAが設定されていません。管理者に連絡してください。' };
    }

    // MFA: チャレンジを作成
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: verifiedTotp.id,
    });
    if (challengeError) {
      console.error('mfa.challenge error:', challengeError);
      return { success: false, error: '認証コードの検証準備に失敗しました' };
    }

    // MFA: TOTPコードを検証
    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: verifiedTotp.id,
      challengeId: challengeData.id,
      code: totpCode!.trim(),
    });
    if (verifyError) {
      return { success: false, error: '認証コードが正しくありません' };
    }

    // AAL2セッションでパスワードを更新
    const { error: updateError } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (updateError) {
      console.error('updateUser error:', updateError);
      return { success: false, error: 'パスワードの変更に失敗しました' };
    }
  }

  // 新しいセッションを取得してクッキーを更新
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData.session) {
    const commonCookie = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: COOKIE_MAX_AGE,
      path: '/',
    };

    cookieStore.set(USER_TOKEN_COOKIE, sessionData.session.access_token, commonCookie);
    cookieStore.set(USER_REFRESH_TOKEN_COOKIE, sessionData.session.refresh_token, commonCookie);

    // 管理者の場合は管理者トークンも更新
    if (cookieStore.get(ADMIN_TOKEN_COOKIE)?.value) {
      cookieStore.set(ADMIN_TOKEN_COOKIE, sessionData.session.access_token, commonCookie);
      cookieStore.set(ADMIN_REFRESH_TOKEN_COOKIE, sessionData.session.refresh_token, commonCookie);
    }
  }

  return { success: true };
}

// メールアドレス変更（メール確認なし、Admin API使用）
export async function changeEmail(
  newEmail: string,
  currentPassword: string,
  totpCode?: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  // バリデーション
  if (!newEmail) {
    return { success: false, error: '新しいメールアドレスを入力してください' };
  }
  if (!newEmail.includes('@')) {
    return { success: false, error: '有効なメールアドレスを入力してください' };
  }
  if (!currentPassword) {
    return { success: false, error: 'パスワードを入力してください' };
  }

  // 開発環境チェック
  const h = await headers();
  const host = h.get('x-forwarded-host') ?? h.get('host');
  const skipMfa = isDevMfaBypass(host);

  // 本番環境ではTOTPコード必須
  if (!skipMfa && (!totpCode || totpCode.trim().length !== 6)) {
    return { success: false, error: '認証コード（6桁）を入力してください' };
  }

  // 現在のトークンからユーザー情報を取得
  const cookieStore = await cookies();
  const token = cookieStore.get(USER_TOKEN_COOKIE)?.value ?? cookieStore.get(ADMIN_TOKEN_COOKIE)?.value;

  if (!token) {
    return { success: false, error: 'ログインセッションが見つかりません。再度ログインしてください。' };
  }

  const supabase = await createSupabaseServerClient();

  // トークンからユーザー情報を取得
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user || !user.email) {
    return { success: false, error: 'ユーザー情報の取得に失敗しました。再度ログインしてください。' };
  }

  // 同じメールアドレスの場合はエラー
  if (user.email === newEmail) {
    return { success: false, error: '現在のメールアドレスと同じです' };
  }

  // 現在のパスワードで再認証（本人確認）
  const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password: currentPassword,
  });

  if (signInError || !signInData.session) {
    return { success: false, error: 'パスワードが正しくありません' };
  }

  // セッションを設定
  await supabase.auth.setSession({
    access_token: signInData.session.access_token,
    refresh_token: signInData.session.refresh_token,
  });

  // 本番環境ではMFA認証
  if (!skipMfa) {
    const { data: factors, error: factorsError } = await supabase.auth.mfa.listFactors();
    if (factorsError) {
      console.error('mfa.listFactors error:', factorsError);
      return { success: false, error: 'MFA情報の取得に失敗しました' };
    }

    const verifiedTotp = factors.totp?.find((f) => f.status === 'verified');
    if (!verifiedTotp) {
      return { success: false, error: 'MFAが設定されていません。管理者に連絡してください。' };
    }

    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: verifiedTotp.id,
    });
    if (challengeError) {
      console.error('mfa.challenge error:', challengeError);
      return { success: false, error: '認証コードの検証準備に失敗しました' };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: verifiedTotp.id,
      challengeId: challengeData.id,
      code: totpCode!.trim(),
    });
    if (verifyError) {
      return { success: false, error: '認証コードが正しくありません' };
    }
  }

  // Admin APIでメールアドレスを変更（メール確認なし）
  const { createClient } = await import('@supabase/supabase-js');
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );

  const { error: adminUpdateError } = await supabaseAdmin.auth.admin.updateUserById(
    user.id,
    { email: newEmail, email_confirm: true }
  );

  if (adminUpdateError) {
    console.error('admin.updateUserById error:', adminUpdateError);
    if (adminUpdateError.message.includes('already registered')) {
      return { success: false, error: 'このメールアドレスは既に使用されています' };
    }
    return { success: false, error: 'メールアドレスの変更に失敗しました' };
  }

  // profilesテーブルのemailも更新
  const { createAuthedAnonServerClient } = await import('@/lib/supabase/authed-anon-server');
  const db = createAuthedAnonServerClient(signInData.session.access_token);
  await db.from('profiles').update({ email: newEmail }).eq('id', user.id);

  return { success: true };
}

