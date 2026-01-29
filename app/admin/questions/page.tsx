import { Suspense } from "react";
import dynamic from "next/dynamic";
import { getCases } from "@/lib/supabase";
import { getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";

// dynamic importでクライアントコンポーネントを遅延ロード
const QuestionsClient = dynamic(
  () => import("./QuestionsClient").then(mod => mod.QuestionsClient),
  { loading: () => <div className="animate-pulse p-8 text-center">読み込み中...</div> }
);

export const metadata = {
  title: "設問管理",
};

// スケルトンローダー
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
  const cases = await getCases();
  return <QuestionsClient cases={cases} />;
}

export default async function QuestionsPage() {
  const userInfo = await getUserWithRole();

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <div className="max-w-4xl mx-auto animate-fade-in">
        <div className="mb-6">
          <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
            設問管理
          </h1>
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
            ケースごとの設問テキストを管理します
          </p>
        </div>

        <Suspense fallback={<CasesSkeleton />}>
          <CasesContent />
        </Suspense>
      </div>
    </DashboardLayout>
  );
}
