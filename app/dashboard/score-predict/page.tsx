// スコア予測ページ（Server Component）
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { hasAnyAccessToken, getUserWithRole } from "@/lib/supabase/server";
import { fetchCasesForScorePrediction } from "@/actions/predictScore";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Calculator } from "lucide-react";

// dynamic importでクライアントコンポーネントを遅延ロード
const ScorePredictClient = dynamic(
  () => import("./ScorePredictClient").then(mod => mod.ScorePredictClient),
  { loading: () => <div className="animate-pulse p-8 text-center">読み込み中...</div> }
);

export const metadata = {
  title: "スコア予測",
};

export default async function ScorePredictPage() {
  if (!(await hasAnyAccessToken())) {
    redirect("/login");
  }

  const userInfo = await getUserWithRole();
  if (!userInfo) {
    redirect("/login");
  }

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
            回答を入力すると、過去の類似回答から予想スコアを算出します
          </p>
        </div>

        {cases.length === 0 ? (
          <div
            className="rounded-xl p-8 lg:p-12 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <Calculator className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-base lg:text-lg font-black mb-2" style={{ color: "#323232" }}>
              ケースデータがありません
            </h3>
            <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
              管理者にデータのアップロードを依頼してください
            </p>
          </div>
        ) : (
          <ScorePredictClient cases={cases} />
        )}
      </div>
    </DashboardLayout>
  );
}
