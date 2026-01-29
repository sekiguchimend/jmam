// Supabase サーバー専用 service_role クライアント（Auth Admin API用）
// 注意: service_role keyは非常に強力な権限を持つため、サーバーサイドでのみ使用
import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Service Role クライアント
 * Auth Admin API（ユーザー削除など）専用
 * RLSをバイパスするため、必要最小限の操作のみに使用すること
 */
export const supabaseServiceRole = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
  },
});
