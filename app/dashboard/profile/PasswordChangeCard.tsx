"use client";

import { useState } from "react";
import { Key } from "lucide-react";
import { PasswordChangeForm } from "./PasswordChangeForm";

export function PasswordChangeCard() {
  const [isOpen, setIsOpen] = useState(false);

  if (isOpen) {
    return <PasswordChangeForm onClose={() => setIsOpen(false)} />;
  }

  return (
    <button
      type="button"
      onClick={() => setIsOpen(true)}
      className="w-full text-left p-4 lg:p-5 rounded-xl transition-all hover:shadow-lg cursor-pointer"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3 lg:gap-4">
        <div className="flex-shrink-0" style={{ color: "var(--primary)" }}>
          <Key className="w-5 lg:w-6 h-5 lg:h-6" />
        </div>
        <div>
          <h3 className="text-sm lg:text-base font-black" style={{ color: "#323232" }}>
            パスワード変更
          </h3>
          <p className="text-xs lg:text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            ログインパスワードを更新
          </p>
        </div>
      </div>
    </button>
  );
}
