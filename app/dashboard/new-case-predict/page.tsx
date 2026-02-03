// スコア予測ページ（Server Component）- 既存/新規ケース両対応
// 認証・レイアウトはlayout.tsxで処理
import { Suspense } from "react";
import dynamic from "next/dynamic";
import { fetchCasesForScorePrediction } from "@/actions/predictScore";

// dynamic importでクライアントコンポーネントを遅延ロード
const NewCasePredictClient = dynamic(
  () => import("./NewCasePredictClient").then(mod => mod.NewCasePredictClient),
  { loading: () => <div className="animate-pulse p-8 text-center">読み込み中...</div> }
);

export const metadata = {
  title: "スコア予測",
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
  const result = await fetchCasesForScorePrediction();
  const cases = result.success ? result.cases ?? [] : [];

  return <NewCasePredictClient cases={cases} />;
}

export default async function NewCasePredictPage() {
  return (
    <div className="max-w-7xl mx-auto animate-fade-in">
      {/* ヘッダー */}
      <div className="mb-6 lg:mb-8">
        <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
          スコア予測
        </h1>
        <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
          既存ケースまたは新規ケースを選択して、解答のスコアを予測します
        </p>
      </div>

      <Suspense fallback={<CasesSkeleton />}>
        <CasesContent />
      </Suspense>
    </div>
  );
}
