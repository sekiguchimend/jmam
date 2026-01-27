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

export default async function QuestionsPage() {
  const userInfo = await getUserWithRole();
  const cases = await getCases();

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

        <QuestionsClient cases={cases} />
      </div>
    </DashboardLayout>
  );
}
