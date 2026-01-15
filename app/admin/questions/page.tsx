import { getCases } from "@/lib/supabase";
import { getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { QuestionsClient } from "./QuestionsClient";

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
