// データセット一覧（Client Component）
// FR-12: データセット管理 - 削除機能

"use client";

import { useState, useTransition } from "react";
import { deleteDatasetByCaseId } from "@/actions/upload";
import type { DatasetStats } from "@/types";
import { FileText, Trash2, Loader2, Package, Calendar } from "lucide-react";

interface AdminDatasetListProps {
  initialStats: DatasetStats[];
}

// 日時フォーマット関数
function formatDate(dateStr: string | null): string {
  if (!dateStr) return "-";
  try {
    const date = new Date(dateStr);
    return date.toLocaleString("ja-JP", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "-";
  }
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
                <div className="min-w-0 flex-1">
                  <p className="text-sm lg:text-base font-black truncate" style={{ color: "#323232" }}>
                    {stat.caseName}
                  </p>
                  <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
                    <span className="hidden sm:inline">ケースID: {stat.caseId} • </span>
                    {stat.recordCount.toLocaleString()}件
                  </p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs" style={{ color: "var(--text-muted)" }}>
                    {stat.fileName && (
                      <span className="truncate max-w-[200px]" title={stat.fileName}>
                        {stat.fileName}
                      </span>
                    )}
                    {stat.uploadedAt && (
                      <span className="flex items-center gap-1 whitespace-nowrap">
                        <Calendar className="w-3 h-3" />
                        {formatDate(stat.uploadedAt)}
                      </span>
                    )}
                  </div>
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
