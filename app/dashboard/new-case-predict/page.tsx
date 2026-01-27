// スコア予測ページ（Server Component）- 既存/新規ケース両対応
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { hasAnyAccessToken, getUserWithRole } from "@/lib/supabase/server";
import { fetchCasesForScorePrediction } from "@/actions/predictScore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// dynamic importでクライアントコンポーネントを遅延ロード
const NewCasePredictClient = dynamic(
  () => import("./NewCasePredictClient").then(mod => mod.NewCasePredictClient),
  { loading: () => <div className="animate-pulse p-8 text-center">読み込み中...</div> }
);

export const metadata = {
  title: "スコア予測",
};

export default async function NewCasePredictPage() {
  if (!(await hasAnyAccessToken())) {
    redirect("/login");
  }

  const userInfo = await getUserWithRole();
  if (!userInfo) {
    redirect("/login");
  }

  // 既存ケース一覧を取得
  const result = await fetchCasesForScorePrediction();
  const cases = result.success ? result.cases ?? [] : [];

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* ヘッダー */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
            スコア予測
          </h1>
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
            既存ケースまたは新規ケースを選択して、回答のスコアを予測します
          </p>
        </div>

        <NewCasePredictClient cases={cases} />
      </div>
    </DashboardLayout>
  );
}
