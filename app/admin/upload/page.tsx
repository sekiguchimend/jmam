// CSVアップロードページ（Server Component）
import { redirect } from "next/navigation";
import { hasAccessToken, getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { UploadClientForm } from "./UploadClientForm";
import Link from "next/link";
import { ChevronRight, Info, Check } from "lucide-react";

export default async function UploadPage() {
  if (!(await hasAccessToken())) {
    redirect("/login");
  }

  const userInfo = await getUserWithRole();
  if (!userInfo || !userInfo.isAdmin) {
    redirect("/dashboard");
  }

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <div className="max-w-3xl mx-auto animate-fade-in">
        {/* パンくず */}
        <div className="flex items-center gap-2 text-xs lg:text-sm mb-4 lg:mb-6 font-bold" style={{ color: "#323232" }}>
          <Link href="/admin" className="hover:underline">
            学習データ
          </Link>
          <ChevronRight className="w-4 h-4" />
          <span>データ追加</span>
        </div>

        {/* ヘッダー */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
            データ追加
          </h1>
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
            新しい学習データ（CSVファイル）を追加します
          </p>
        </div>

        {/* アップロードフォーム */}
        <div
          className="rounded-xl p-4 lg:p-6 mb-4 lg:mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <UploadClientForm />
        </div>

        {/* 注意事項 */}
        <div
          className="rounded-xl p-4 lg:p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h3 className="text-sm lg:text-base font-black mb-3 lg:mb-4 flex items-center gap-2" style={{ color: "#323232" }}>
            <Info className="w-4 lg:w-5 h-4 lg:h-5" />
            CSVファイルの形式
          </h3>
          <ul className="space-y-2 lg:space-y-3 text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
            <li className="flex items-start gap-2 lg:gap-3">
              <Check className="w-4 lg:w-5 h-4 lg:h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
              必須カラム: 受注番号, Ⅱ MC 題材コード
            </li>
            <li className="flex items-start gap-2 lg:gap-3">
              <Check className="w-4 lg:w-5 h-4 lg:h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
              ヘッダー行（固定行がある場合は2行目）が必要です
            </li>
            <li className="flex items-start gap-2 lg:gap-3">
              <Check className="w-4 lg:w-5 h-4 lg:h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
              文字コード: UTF-8 または Shift_JIS
            </li>
            <li className="flex items-start gap-2 lg:gap-3">
              <Check className="w-4 lg:w-5 h-4 lg:h-5 flex-shrink-0 mt-0.5" style={{ color: "var(--success)" }} />
              同一の受注番号がある場合は上書きされます
            </li>
          </ul>
        </div>
      </div>
    </DashboardLayout>
  );
}
