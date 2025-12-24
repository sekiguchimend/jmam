// 管理者セットアップフォーム（Client Component）

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createAdminUser } from "@/actions/auth";
import { Check, Loader2 } from "lucide-react";

export function SetupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    const password = formData.get('password') as string;
    const confirmPassword = formData.get('confirmPassword') as string;

    if (password !== confirmPassword) {
      setError('パスワードが一致しません');
      return;
    }

    if (password.length < 8) {
      setError('パスワードは8文字以上で設定してください');
      return;
    }

    startTransition(async () => {
      const result = await createAdminUser(formData);

      if (result.success) {
        setSuccess(true);
        setTimeout(() => {
          router.push("/login?redirect=/admin");
        }, 2000);
      } else {
        setError(result.error || "管理者の作成に失敗しました");
      }
    });
  };

  if (success) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
      >
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "#323232" }}
        >
          <Check className="w-8 h-8" style={{ color: "#fff" }} />
        </div>
        <h3 className="text-lg font-black mb-2" style={{ color: "#323232" }}>
          管理者アカウントを作成しました
        </h3>
        <p className="font-bold" style={{ color: "#323232" }}>
          ログインページへリダイレクトします...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        className="rounded-2xl p-8"
        style={{ background: "#f9f9f9", border: "1px solid #e5e5e5" }}
      >
        {/* エラー表示 */}
        {error && (
          <div
            className="mb-6 p-4 rounded-xl text-sm font-bold"
            style={{ background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626" }}
          >
            {error}
          </div>
        )}

        {/* 名前 */}
        <div className="mb-6">
          <label
            htmlFor="name"
            className="block text-sm font-bold mb-2"
            style={{ color: "#323232" }}
          >
            管理者名（任意）
          </label>
          <input
            type="text"
            id="name"
            name="name"
            className="w-full px-4 py-3 rounded-xl text-base font-bold"
            style={{
              border: "2px solid #e5e5e5",
              background: "#fff",
              color: "#323232",
            }}
            placeholder="管理者"
          />
        </div>

        {/* メールアドレス */}
        <div className="mb-6">
          <label
            htmlFor="email"
            className="block text-sm font-bold mb-2"
            style={{ color: "#323232" }}
          >
            メールアドレス <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="email"
            id="email"
            name="email"
            required
            className="w-full px-4 py-3 rounded-xl text-base font-bold"
            style={{
              border: "2px solid #e5e5e5",
              background: "#fff",
              color: "#323232",
            }}
            placeholder="admin@example.com"
          />
        </div>

        {/* パスワード */}
        <div className="mb-6">
          <label
            htmlFor="password"
            className="block text-sm font-bold mb-2"
            style={{ color: "#323232" }}
          >
            パスワード <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="password"
            id="password"
            name="password"
            required
            minLength={8}
            className="w-full px-4 py-3 rounded-xl text-base font-bold"
            style={{
              border: "2px solid #e5e5e5",
              background: "#fff",
              color: "#323232",
            }}
            placeholder="8文字以上"
          />
        </div>

        {/* パスワード確認 */}
        <div className="mb-6">
          <label
            htmlFor="confirmPassword"
            className="block text-sm font-bold mb-2"
            style={{ color: "#323232" }}
          >
            パスワード確認 <span style={{ color: "#dc2626" }}>*</span>
          </label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            required
            minLength={8}
            className="w-full px-4 py-3 rounded-xl text-base font-bold"
            style={{
              border: "2px solid #e5e5e5",
              background: "#fff",
              color: "#323232",
            }}
            placeholder="パスワードを再入力"
          />
        </div>

        {/* 登録ボタン */}
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-4 rounded-xl font-black text-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: "#323232", color: "#fff" }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              作成中...
            </span>
          ) : (
            "管理者アカウントを作成"
          )}
        </button>
      </div>
    </form>
  );
}
