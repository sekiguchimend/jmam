"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Key, X, Check, Smartphone } from "lucide-react";
import { Button } from "@/components/ui";
import { changePassword } from "@/actions/auth";

type Props = {
  onClose: () => void;
};

export function PasswordChangeForm({ onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");

  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // クライアント側バリデーション
    if (!currentPassword) {
      setError("現在のパスワードを入力してください");
      return;
    }
    if (!newPassword) {
      setError("新しいパスワードを入力してください");
      return;
    }
    if (newPassword.length < 8) {
      setError("新しいパスワードは8文字以上で入力してください");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("新しいパスワードが一致しません");
      return;
    }
    // TOTPコードはサーバー側で必要かどうか判断（開発環境では不要）
    startTransition(async () => {
      const result = await changePassword(currentPassword, newPassword, totpCode || undefined);
      if (!result.success) {
        setError(result.error ?? "パスワードの変更に失敗しました");
        return;
      }
      setSuccess(true);
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
              パスワードを変更しました
            </h3>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
              次回ログイン時から新しいパスワードをご使用ください
            </p>
          </div>
        </div>
        <Button type="button" variant="secondary" size="sm" onClick={onClose}>
          閉じる
        </Button>
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
            <Key className="w-5 h-5" />
          </div>
          <h3 className="text-base font-black" style={{ color: "#323232" }}>
            パスワード変更
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
        {/* 現在のパスワード */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            現在のパスワード
          </label>
          <div className="relative">
            <input
              type={showCurrent ? "text" : "password"}
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
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
              onClick={() => setShowCurrent(!showCurrent)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "var(--text-muted)" }}
            >
              {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 新しいパスワード */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            新しいパスワード
          </label>
          <div className="relative">
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm font-bold transition-all"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "#323232",
              }}
              placeholder="8文字以上"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "var(--text-muted)" }}
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* 新しいパスワード（確認） */}
        <div>
          <label className="block text-xs font-bold mb-1.5" style={{ color: "var(--text-muted)" }}>
            新しいパスワード（確認）
          </label>
          <div className="relative">
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-3 py-2.5 pr-10 rounded-lg text-sm font-bold transition-all"
              style={{
                border: "1px solid var(--border)",
                background: "var(--surface)",
                color: "#323232",
              }}
              placeholder="もう一度入力"
              autoComplete="new-password"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              style={{ color: "var(--text-muted)" }}
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
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
