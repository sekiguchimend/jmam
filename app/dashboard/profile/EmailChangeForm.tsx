"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Mail, X, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";
import { changeEmail } from "@/actions/auth";

type Props = {
  currentEmail: string;
  onClose: () => void;
};

export function EmailChangeForm({ currentEmail, onClose }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [newEmail, setNewEmail] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // クライアント側バリデーション
    if (!newEmail) {
      setError("新しいメールアドレスを入力してください");
      return;
    }
    if (!newEmail.includes("@")) {
      setError("有効なメールアドレスを入力してください");
      return;
    }
    if (newEmail === currentEmail) {
      setError("現在のメールアドレスと同じです");
      return;
    }
    if (!password) {
      setError("パスワードを入力してください");
      return;
    }

    startTransition(async () => {
      const result = await changeEmail(newEmail, password, totpCode || undefined);
      if (!result.success) {
        setError(result.error ?? "メールアドレスの変更に失敗しました");
        return;
      }
      setSuccess(true);
      // 3秒後にページをリフレッシュ
      setTimeout(() => {
        router.refresh();
        onClose();
      }, 2000);
    });
  };

  if (success) {
    return (
      <div
        className="rounded-xl p-4 lg:p-6"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--success)", color: "#fff" }}
          >
            <Check className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black" style={{ color: "#323232" }}>
              メールアドレスを変更しました
            </h3>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              {newEmail}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="rounded-xl p-4 lg:p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center"
            style={{ background: "var(--primary)", color: "#fff" }}
          >
            <Mail className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black" style={{ color: "#323232" }}>
            メールアドレス変更
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:opacity-70 transition-opacity"
          style={{ color: "var(--text-muted)" }}
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 現在のメールアドレス（表示のみ） */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            現在のメールアドレス
          </label>
          <p className="text-sm font-bold px-3 py-2.5" style={{ color: "#323232" }}>
            {currentEmail}
          </p>
        </div>

        {/* 新しいメールアドレス */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            新しいメールアドレス
          </label>
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="w-full px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "#323232",
            }}
            placeholder="example@example.com"
            autoComplete="email"
          />
        </div>

        {/* パスワード */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            パスワード（本人確認）
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm font-bold transition-all"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "#323232",
              }}
              placeholder="現在のパスワード"
              autoComplete="current-password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "var(--text-muted)" }}
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 認証コード（TOTP） */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            <span className="flex items-center gap-1.5">
              <Smartphone className="w-3.5 h-3.5" />
              認証コード（6桁）
            </span>
          </label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            value={totpCode}
            onChange={(e) => setTotpCode(e.target.value.replace(/[^0-9]/g, ""))}
            className="w-full px-3 py-2.5 rounded-lg text-sm font-bold transition-all tracking-widest"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "#323232",
            }}
            placeholder="000000"
            autoComplete="one-time-code"
          />
          <p className="text-[11px] font-bold mt-1" style={{ color: "var(--text-muted)" }}>
            認証アプリに表示されている6桁のコードを入力
          </p>
        </div>

        {/* エラーメッセージ */}
        {error && (
          <p className="text-xs font-bold" style={{ color: "var(--error)" }}>
            {error}
          </p>
        )}

        {/* ボタン */}
        <div className="flex gap-2 pt-2">
          <Button type="submit" isLoading={isPending} className="flex-1">
            変更する
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onClose}
            disabled={isPending}
          >
            キャンセル
          </Button>
        </div>
      </form>
    </div>
  );
}
