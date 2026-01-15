// データセット一覧（Client Component）
// FR-12: データセット管理 - 削除機能

"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { deleteDatasetByCaseId } from "@/actions/upload";
import type { DatasetStats } from "@/types";
import { FileText, Trash2, Loader2, Package } from "lucide-react";

interface AdminDatasetListProps {
  initialStats: DatasetStats[];
}

export function AdminDatasetList({ initialStats }: AdminDatasetListProps) {
  const [stats, setStats] = useState(initialStats);
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (caseId: string, caseName: string | null) => {
    const displayName = caseName || caseId;
    if (!confirm(`「${displayName}」のデータを削除しますか？\nこの操作は取り消せません。`)) {
      return;
    }

    setDeletingId(caseId);
    startTransition(async () => {
      const result = await deleteDatasetByCaseId(caseId);
      if (result.success) {
        setStats((prev) => prev.filter((s) => s.caseId !== caseId));
      } else {
        alert(`削除に失敗しました: ${result.error}`);
      }
      setDeletingId(null);
    });
  };

  return (
    <div>
      {stats.length === 0 ? (
        <div className="p-8 lg:p-12 text-center">
          <Package className="w-12 lg:w-16 h-12 lg:h-16 mx-auto mb-3 lg:mb-4" style={{ color: "var(--text-muted)" }} />
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>データがありません</p>
          <Link
            href="/admin/upload"
            className="inline-block mt-3 lg:mt-4 px-5 lg:px-6 py-2 rounded-lg font-black text-white text-sm lg:text-base"
            style={{ background: "var(--primary)" }}
          >
            データ追加
          </Link>
        </div>
      ) : (
        <div>
          {stats.map((stat, index) => (
            <div
              key={stat.caseId}
              className="px-4 lg:px-6 py-3 lg:py-4 flex items-center justify-between hover:bg-gray-50 transition-colors"
              style={{
                borderBottom: index < stats.length - 1 ? "1px solid var(--border)" : "none",
              }}
            >
              <div className="flex items-center gap-3 lg:gap-4 min-w-0 flex-1">
                <FileText className="w-4 lg:w-5 h-4 lg:h-5 flex-shrink-0 hidden sm:block" style={{ color: "var(--primary)" }} />
                <div className="min-w-0">
                  <p className="text-sm lg:text-base font-black truncate" style={{ color: "#323232" }}>
                    {stat.caseName}
                  </p>
                  <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
                    <span className="hidden sm:inline">ケースID: {stat.caseId} • </span>
                    {stat.recordCount.toLocaleString()}件
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleDelete(stat.caseId, stat.caseName)}
                disabled={isPending && deletingId === stat.caseId}
                className="p-1.5 lg:p-2 rounded-lg transition-colors hover:bg-red-50 disabled:opacity-50 flex-shrink-0 ml-2"
                style={{ color: "var(--error)" }}
              >
                {isPending && deletingId === stat.caseId ? (
                  <Loader2 className="w-4 lg:w-5 h-4 lg:h-5 animate-spin" />
                ) : (
                  <Trash2 className="w-4 lg:w-5 h-4 lg:h-5" />
                )}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
