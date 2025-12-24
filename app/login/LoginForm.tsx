"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { login } from "@/actions/auth";
import { Mail, AlertCircle, ArrowRight, Loader2, Lock } from "lucide-react";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState<string>("");
  const [password, setPassword] = useState<string>("");
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    if (email) formData.set("email", email);
    if (password) formData.set("password", password);

    startTransition(async () => {
      const result = await login(formData);

      if (result.success) {
        router.push(result.redirectTo || "/dashboard");
        router.refresh();
      } else {
        setError(result.error || "ログインに失敗しました");
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* エラー表示 */}
      {error && (
        <div
          className="p-4 rounded-lg text-sm font-bold flex items-center gap-3 animate-slide-up"
          style={{ background: "var(--error-light)", color: "#323232" }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {/* メールアドレス */}
      <div>
        <label
          htmlFor="email"
          className="block text-sm font-extrabold mb-2"
          style={{ color: "#323232" }}
        >
          メールアドレス
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Mail className="w-5 h-5" style={{ color: "#323232" }} />
          </div>
          <input
            type="email"
            id="email"
            name="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg text-base font-bold transition-all"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "#323232",
            }}
            placeholder="you@example.com"
          />
        </div>
      </div>

      {/* パスワード */}
      <div>
        <label
          htmlFor="password"
          className="block text-sm font-extrabold mb-2"
          style={{ color: "#323232" }}
        >
          パスワード
        </label>
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <Lock className="w-5 h-5" style={{ color: "#323232" }} />
          </div>
          <input
            type="password"
            id="password"
            name="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-lg text-base font-bold transition-all"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "#323232",
            }}
            placeholder="********"
          />
        </div>
      </div>

      {/* ログインボタン */}
      <button
        type="submit"
        disabled={isPending}
        className="w-full py-3 px-4 rounded-lg font-extrabold text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98]"
        style={{
          background: "var(--primary)",
          color: "white",
        }}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2 font-extrabold">
            <Loader2 className="w-5 h-5 animate-spin" />
            ログイン中...
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2 font-extrabold">
            ログイン
            <ArrowRight className="w-5 h-5" />
          </span>
        )}
      </button>
    </form>
  );
}
