// 管理者用：予測履歴ページ（Server Component）
import { Suspense } from "react";
import { AdminHistoryClient } from "./AdminHistoryClient";
import { adminFetchPredictionHistory } from "@/actions/predictionHistory";
import { Loader2 } from "lucide-react";

export const metadata = {
  title: "予測履歴 | 管理者",
};

// 履歴データ取得コンポーネント
async function HistoryData() {
  const result = await adminFetchPredictionHistory({ limit: 50 });

  if (!result.success) {
    return (
      <div className="text-center py-12">
        <p className="text-sm font-bold" style={{ color: "var(--error)" }}>
          {result.error}
        </p>
      </div>
    );
  }

  return <AdminHistoryClient initialRecords={result.records ?? []} initialTotal={result.total ?? 0} />;
}

export default function AdminHistoryPage() {
  return (
    <div className="animate-fade-in">
      {/* ヘッダー */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
          予測履歴
        </h1>
        <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
          全ユーザーの予測履歴を確認できます
        </p>
      </div>

      <Suspense
        fallback={
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin" style={{ color: "var(--primary)" }} />
          </div>
        }
      >
        <HistoryData />
      </Suspense>
    </div>
  );
}
