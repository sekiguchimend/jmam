'use server';

import { revalidatePath } from 'next/cache';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import { getAnyAccessToken, getAuthedUserId, getUserWithRole } from '@/lib/supabase/server';
import { sanitizeText, containsDangerousPatterns } from '@/lib/security';

export type UserInfo = {
  id: string;
  email: string;
  name: string | null;
  isAdmin: boolean;
};

export async function getUserInfo(): Promise<UserInfo | null> {
  try {
    const userInfo = await getUserWithRole();
    return {
      id: userInfo.id,
      email: userInfo.email,
      name: userInfo.name,
      isAdmin: userInfo.isAdmin,
    };
  } catch {
    return null;
  }
}

export type UpdateMyDisplayNameState = {
  ok: boolean;
  error?: string;
  name?: string | null;
};

const MAX_NAME_LEN = 50;

export async function updateMyDisplayName(
  _prevState: UpdateMyDisplayNameState,
  formData: FormData
): Promise<UpdateMyDisplayNameState> {
  const raw = String(formData.get('name') ?? '');
  const name = raw.trim();

  if (name.length > MAX_NAME_LEN) {
    return { ok: false, error: `表示名は${MAX_NAME_LEN}文字以内で入力してください` };
  }

  // XSS対策: 危険なパターンを含む入力を拒否
  if (name && containsDangerousPatterns(name)) {
    return { ok: false, error: '使用できない文字が含まれています' };
  }

  // XSS対策: 表示名をサニタイズ
  const sanitizedName = sanitizeText(name, MAX_NAME_LEN);

  const token = await getAnyAccessToken();
  const userId = await getAuthedUserId();
  if (!token || !userId) {
    return { ok: false, error: 'ログイン状態を確認できませんでした（再ログインしてください）' };
  }

  try {
    const db = createAuthedAnonServerClient(token);
    // XSS対策: サニタイズ済みの名前を保存
    const { error } = await db.from('profiles').update({ name: sanitizedName || null }).eq('id', userId);
    if (error) {
      console.error('updateMyDisplayName error:', error);
      return { ok: false, error: '表示名の更新に失敗しました' };
    }
  } catch (e) {
    console.error('updateMyDisplayName exception:', e);
    return { ok: false, error: '表示名の更新に失敗しました' };
  }

  // ナビゲーション表示名などを更新
  revalidatePath('/dashboard', 'layout');
  revalidatePath('/admin', 'layout');
  revalidatePath('/dashboard/profile');

  return { ok: true, name: sanitizedName || null };
}


