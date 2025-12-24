// 初期管理者セットアップページ
// 初回のみ管理者ユーザーを作成するためのページ

import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { SetupForm } from "./SetupForm";

export default async function SetupPage() {
  // 既に管理者が存在する場合はログインページへリダイレクト
  const supabase = await createSupabaseServerClient();
  const { count, error } = await supabase
    .from('admin_users')
    .select('*', { count: 'exact', head: true });

  if (!error && count && count > 0) {
    redirect('/login?redirect=/admin');
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "#fff" }}>
      {/* ヘッダー */}
      <header style={{ background: "#323232" }} className="px-8 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <Link href="/" className="text-xl font-bold" style={{ color: "#fff" }}>
            職場改善スコア回答予測システム
          </Link>
        </div>
      </header>

      {/* メイン */}
      <main className="flex-1 flex items-center justify-center px-8 py-12">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: "#323232" }}
            >
              <svg className="w-8 h-8" fill="none" stroke="#fff" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold mb-2" style={{ color: "#323232" }}>
              初期セットアップ
            </h1>
            <p style={{ color: "#666" }}>
              最初の管理者アカウントを作成してください
            </p>
          </div>

          <SetupForm />

          <div className="mt-8 p-4 rounded-xl" style={{ background: "#f9f9f9" }}>
            <p className="text-xs text-center" style={{ color: "#666" }}>
              このページは初回セットアップ時のみアクセス可能です。<br />
              管理者が登録されると、自動的にログインページへリダイレクトされます。
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

