// ログイン画面
import { redirect } from "next/navigation";
import { hasAnyAccessToken } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export default async function LoginPage() {
  // 既にログイン済みの場合はダッシュボードへ
  if (await hasAnyAccessToken()) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 lg:p-8" style={{ background: "var(--surface)" }}>
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-6 lg:mb-8">
          <h2 className="text-2xl lg:text-3xl font-black mb-2" style={{ color: "#323232" }}>
            ログイン
          </h2>
          <p className="font-bold" style={{ color: "#323232" }}>
            アカウントにログインしてください
          </p>
        </div>

        <LoginForm />

        <div className="mt-8 text-center">
          <p className="text-sm font-bold" style={{ color: "#323232" }}>
            © 2024 ScorePredict. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  );
}
