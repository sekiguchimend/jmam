// 解答予測ページ（Server Component）
// 認証・レイアウトはlayout.tsxで処理
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { fetchCases } from "@/actions/predict";
import { Inbox } from "lucide-react";

// dynamic importでクライアントコンポーネントを遅延ロード
const PredictClient = dynamic(() => import("./PredictClient").then(mod => mod.PredictClient), {
  loading: () => <div className="animate-pulse p-8 text-center">読み込み中...</div>,
});

export const metadata = {
  title: "解答予測",
};

// ケース一覧のスケルトン
function CasesSkeleton() {
  return (
    <div
      className="rounded-xl p-8"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-1/4 mb-6" />
        <div className="space-y-4">
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
          <div className="h-12 bg-gray-200 rounded" />
        </div>
      </div>
    </div>
  );
}

// ケース一覧を取得して表示するコンポーネント
async function CasesContent() {
  const cases = await fetchCases();

  if (cases.length === 0) {
    return (
      <div
        className="rounded-xl p-8 lg:p-12 text-center"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <Inbox className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
        <h3 className="text-base lg:text-lg font-black mb-2" style={{ color: "#323232" }}>
          ケースデータがありません
        </h3>
        <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
          管理者にデータのアップロードを依頼してください
        </p>
      </div>
    );
  }

  return <PredictClient cases={cases} />;
}

export default async function PredictPage() {
  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* ヘッダー */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
          解答予測
        </h1>
        <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
          ケースを選択し、目標スコアを設定してAIが最適な解答を予測します
        </p>
      </div>

      <Suspense fallback={<CasesSkeleton />}>
        <CasesContent />
      </Suspense>
    </div>
  );
}
