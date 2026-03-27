// 新規ケース作成フォーム（Client Component）
// 解答データなしでケースID・ケース名のみを登録

"use client";

import { useState, useTransition } from "react";
import { createNewCase } from "@/actions/upload";
import { FolderPlus, Check, Loader2 } from "lucide-react";

export function CreateCaseForm() {
  const [caseId, setCaseId] = useState("");
  const [caseName, setCaseName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = () => {
    if (!caseId.trim()) {
      setError("ケースIDを入力してください");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await createNewCase({
        caseId: caseId.trim(),
        caseName: caseName.trim(),
      });

      if (result.success) {
        setSuccess(`ケース「${caseName.trim() || caseId.trim()}」を作成しました`);
        setCaseId("");
        setCaseName("");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error ?? "ケースの作成に失敗しました");
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <FolderPlus className="w-5 h-5" style={{ color: "#323232" }} />
        <h3 className="text-sm font-black" style={{ color: "#323232" }}>
          新規ケース作成
        </h3>
      </div>

      <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
        解答データなしでケースを先に作成できます。作成後、設問管理画面でシチュエーション・設問を登録してください。
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {/* ケースID */}
        <label className="block">
          <span className="text-xs font-black" style={{ color: "#323232" }}>
            ケースID <span style={{ color: "var(--error)" }}>*</span>
          </span>
          <input
            type="text"
            value={caseId}
            onChange={(e) => {
              setCaseId(e.target.value);
              if (error) setError(null);
            }}
            placeholder="例: case_001"
            disabled={isPending}
            className="mt-1 w-full px-3 h-11 rounded-lg border text-sm font-bold outline-none transition-colors focus:border-[#323232]"
            style={{ borderColor: "var(--border)", color: "#323232" }}
          />
        </label>

        {/* ケース名 */}
        <label className="block">
          <span className="text-xs font-black" style={{ color: "#323232" }}>
            ケース名（任意）
          </span>
          <input
            type="text"
            value={caseName}
            onChange={(e) => setCaseName(e.target.value)}
            placeholder="例: 新人指導ケース"
            disabled={isPending}
            className="mt-1 w-full px-3 h-11 rounded-lg border text-sm font-bold outline-none transition-colors focus:border-[#323232]"
            style={{ borderColor: "var(--border)", color: "#323232" }}
          />
        </label>
      </div>

      {/* エラー */}
      {error && (
        <div
          className="px-3 py-2 rounded-lg text-xs font-bold"
          style={{ background: "#fef2f2", color: "#dc2626" }}
        >
          {error}
        </div>
      )}

      {/* 成功 */}
      {success && (
        <div
          className="px-3 py-2 rounded-lg text-xs font-bold flex items-center gap-2"
          style={{ background: "#f0fdf4", color: "#16a34a" }}
        >
          <Check className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* 作成ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handleSubmit}
          disabled={isPending || !caseId.trim()}
          className="px-5 py-2 rounded-lg text-sm font-black transition-all hover:opacity-90 disabled:opacity-50 flex items-center gap-2"
          style={{ background: "var(--primary)", color: "#fff" }}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              作成中...
            </>
          ) : (
            <>
              <FolderPlus className="w-4 h-4" />
              ケースを作成
            </>
          )}
        </button>
      </div>
    </div>
  );
}
