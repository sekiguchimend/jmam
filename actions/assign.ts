// 管理者：割り当て（ユーザー⇔ケース）のServer Actions
// 非機能要件 SE-03: ブラウザからDBへ直接アクセスさせない（サーバー経由）

'use server';

import { hasAccessToken, getAccessToken } from '@/lib/supabase/server';
import { createAuthedAnonServerClient } from '@/lib/supabase/authed-anon-server';
import type { Database } from '@/types/database';

const MAX_ASSIGNMENTS = 5;

type AssignUser = {
  id: string;
  email: string | null;
  name: string | null;
  status: 'active' | 'suspended' | 'deleted';
};

type AssignCase = {
  id: string;
  name: string | null;
};

type CaseAssignmentRow = {
  user_id: string;
  case_id: string;
};

type SupabaseErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
};

async function ensureAdmin(): Promise<string> {
  if (!(await hasAccessToken())) {
    throw new Error('管理者権限が必要です');
  }
  const token = await getAccessToken();
  if (!token) throw new Error('管理者権限が必要です');

  // middlewareはcookie有無のみなので、DB上でも「有効な管理者」かを確認する
  // （RLSの is_admin() が false のままだと、以降のクエリが403になり得るため）
  const supabase = createAuthedAnonServerClient(token);
  const adminRes = await supabase.from('admin_users').select('id, is_active').maybeSingle();
  if (adminRes.error) {
    console.error('ensureAdmin admin_users check error:', adminRes.error);
    throw new Error('管理者権限の確認に失敗しました（再ログインしてください）');
  }
  if (!adminRes.data?.id || adminRes.data.is_active !== true) {
    throw new Error('管理者権限がありません');
  }

  return token;
}

function uniqueNonEmptyStrings(values: string[]): string[] {
  const set = new Set<string>();
  for (const v of values) {
    const s = String(v ?? '').trim();
    if (!s) continue;
    set.add(s);
  }
  return [...set];
}

export async function adminFetchAssignInitial(): Promise<{
  users: AssignUser[];
  cases: AssignCase[];
  assignments: CaseAssignmentRow[];
}> {
  const token = await ensureAdmin();
  const supabase = createAuthedAnonServerClient(token);

  // users（profiles）: ここでは割り当て対象を active のみにする
  const usersRes = await supabase
    .from('profiles')
    .select('id, email, name, status')
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(2000);
  if (usersRes.error) {
    const e = usersRes.error as unknown as SupabaseErrorLike;
    console.error('adminFetchAssignInitial users error:', {
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      code: e?.code,
    });
    throw new Error('ユーザー一覧の取得に失敗しました');
  }

  const casesRes = await supabase
    .from('cases')
    .select('case_id, case_name')
    .order('case_id');
  if (casesRes.error) {
    const e = casesRes.error as unknown as SupabaseErrorLike;
    console.error('adminFetchAssignInitial cases error:', {
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      code: e?.code,
    });
    throw new Error('ケース一覧の取得に失敗しました');
  }

  const assignsRes = await supabase
    .from('case_assignments')
    .select('user_id, case_id')
    .order('created_at', { ascending: false });
  if (assignsRes.error) {
    const e = assignsRes.error as unknown as SupabaseErrorLike;
    console.error('adminFetchAssignInitial assignments error:', {
      message: e?.message,
      details: e?.details,
      hint: e?.hint,
      code: e?.code,
    });
    // テーブル未作成などは運用で気づけるように明示
    throw new Error('割り当てデータの取得に失敗しました（case_assignments を確認してください）');
  }

  type ProfileRow = Pick<
    Database['public']['Tables']['profiles']['Row'],
    'id' | 'email' | 'name' | 'status'
  >;
  type CaseRow = Pick<Database['public']['Tables']['cases']['Row'], 'case_id' | 'case_name'>;
  type AssignmentRow = Pick<
    Database['public']['Tables']['case_assignments']['Row'],
    'user_id' | 'case_id'
  >;

  const users: AssignUser[] =
    ((usersRes.data ?? []) as ProfileRow[]).map((u) => ({
      id: u.id,
      email: u.email ?? null,
      name: u.name ?? null,
      status: u.status,
    })) ?? [];

  const cases: AssignCase[] =
    ((casesRes.data ?? []) as CaseRow[]).map((c) => ({
      id: c.case_id,
      name: c.case_name ?? null,
    })) ?? [];

  const assignments: CaseAssignmentRow[] =
    ((assignsRes.data ?? []) as AssignmentRow[]).map((r) => ({
      user_id: r.user_id,
      case_id: r.case_id,
    })) ?? [];

  return { users, cases, assignments };
}

export async function adminSaveUserAssignments(params: {
  userId: string;
  caseIds: string[];
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const token = await ensureAdmin();
    const supabase = createAuthedAnonServerClient(token);

    const userId = String(params.userId ?? '').trim();
    if (!userId) return { success: false, error: 'ユーザーが未選択です' };

    const caseIds = uniqueNonEmptyStrings(params.caseIds ?? []);
    if (caseIds.length > MAX_ASSIGNMENTS) {
      return { success: false, error: `割り当ては最大${MAX_ASSIGNMENTS}件までです` };
    }

    // 現在の割り当てを取得→差分更新（delete→insertでの消失リスクを避ける）
    const currentRes = await supabase
      .from('case_assignments')
      .select('user_id, case_id')
      .eq('user_id', userId);
    if (currentRes.error) {
      console.error('adminSaveUserAssignments read error:', currentRes.error);
      return { success: false, error: '現在の割り当て取得に失敗しました' };
    }

    type AssignmentRow = Pick<
      Database['public']['Tables']['case_assignments']['Row'],
      'user_id' | 'case_id'
    >;
    const current = new Set<string>(((currentRes.data ?? []) as AssignmentRow[]).map((r) => r.case_id));
    const next = new Set<string>(caseIds);

    const toDelete = [...current].filter((id) => !next.has(id));
    const toInsert = [...next].filter((id) => !current.has(id));

    if (toDelete.length > 0) {
      const delRes = await supabase
        .from('case_assignments')
        .delete()
        .eq('user_id', userId)
        .in('case_id', toDelete);
      if (delRes.error) {
        console.error('adminSaveUserAssignments delete error:', delRes.error);
        return { success: false, error: '割り当ての削除に失敗しました' };
      }
    }

    if (toInsert.length > 0) {
      const insRes = await supabase.from('case_assignments').insert(
        toInsert.map((caseId) => ({
          user_id: userId,
          case_id: caseId,
        }))
      );
      if (insRes.error) {
        console.error('adminSaveUserAssignments insert error:', insRes.error);
        return { success: false, error: '割り当ての保存に失敗しました' };
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '保存に失敗しました' };
  }
}

export async function adminSaveCaseAssignments(params: {
  caseId: string;
  userIds: string[];
}): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const token = await ensureAdmin();
    const supabase = createAuthedAnonServerClient(token);

    const caseId = String(params.caseId ?? '').trim();
    if (!caseId) return { success: false, error: 'ケースが未選択です' };

    const userIds = uniqueNonEmptyStrings(params.userIds ?? []);
    if (userIds.length > MAX_ASSIGNMENTS) {
      return { success: false, error: `割り当ては最大${MAX_ASSIGNMENTS}件までです` };
    }

    const currentRes = await supabase
      .from('case_assignments')
      .select('user_id, case_id')
      .eq('case_id', caseId);
    if (currentRes.error) {
      console.error('adminSaveCaseAssignments read error:', currentRes.error);
      return { success: false, error: '現在の割り当て取得に失敗しました' };
    }

    type AssignmentRow = Pick<
      Database['public']['Tables']['case_assignments']['Row'],
      'user_id' | 'case_id'
    >;
    const current = new Set<string>(((currentRes.data ?? []) as AssignmentRow[]).map((r) => r.user_id));
    const next = new Set<string>(userIds);

    const toDelete = [...current].filter((id) => !next.has(id));
    const toInsert = [...next].filter((id) => !current.has(id));

    if (toDelete.length > 0) {
      const delRes = await supabase
        .from('case_assignments')
        .delete()
        .eq('case_id', caseId)
        .in('user_id', toDelete);
      if (delRes.error) {
        console.error('adminSaveCaseAssignments delete error:', delRes.error);
        return { success: false, error: '割り当ての削除に失敗しました' };
      }
    }

    if (toInsert.length > 0) {
      const insRes = await supabase.from('case_assignments').insert(
        toInsert.map((userId) => ({
          user_id: userId,
          case_id: caseId,
        }))
      );
      if (insRes.error) {
        console.error('adminSaveCaseAssignments insert error:', insRes.error);
        return { success: false, error: '割り当ての保存に失敗しました' };
      }
    }

    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : '保存に失敗しました' };
  }
}


