// anon key + Authorization(JWT) でDBへアクセスするサーバー専用クライアント
// このプロジェクトは独自Cookie(admin_access_token/user_access_token)でJWTを保持しているため、
// PostgRESTへJWTを渡す用途で使う（RLSのauth.uid()が効く）。

import 'server-only';

import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createAuthedAnonServerClient(accessToken: string) {
  return createClient<Database>(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}


