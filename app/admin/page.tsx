// 管理者ダッシュボード（Server Component）
// ミドルウェアで認証済みなので、ここでは認証チェック不要
import { getUserWithRole } from "@/lib/supabase/server";
import { fetchDatasetStats, fetchTotalCount } from "@/actions/upload";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { AdminDatasetList } from "./AdminDatasetList";
import Link from "next/link";
import { Briefcase, Database, CheckCircle, Plus } from "lucide-react";

export default async function AdminPage() {
  // ミドルウェアで admin_access_token をチェック済み
  const userInfo = await getUserWithRole();

  const [stats, totalCount] = await Promise.all([
    fetchDatasetStats(),
    fetchTotalCount(),
  ]);

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <div className="max-w-7xl mx-auto animate-fade-in">
        {/* ヘッダー */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 lg:mb-8">
          <div>
            <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
              学習データ
            </h1>
            <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
              登録済みデータの確認・削除
            </p>
          </div>
          <Link
            href="/admin/upload"
            className="inline-flex items-center justify-center gap-2 px-6 py-3 font-black transition-all hover:opacity-90 text-white text-sm"
            style={{
              background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
              borderRadius: "5px"
            }}
          >
            <Plus className="w-4 h-4" />
            データ追加
          </Link>
        </div>

        {/* 統計テーブル */}
        <div
          className="overflow-hidden mb-6 lg:mb-8 max-w-lg mx-auto"
          style={{ 
            background: "var(--surface)", 
            border: "1px solid var(--border)",
            borderRadius: "5px"
          }}
        >
          <table className="w-full">
            <thead>
              <tr style={{ background: "var(--background)", borderBottom: "2px solid var(--border)" }}>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-center">
                  <div className="flex items-center justify-center gap-2 lg:gap-4">
                    <Briefcase className="w-5 lg:w-6 h-5 lg:h-6 flex-shrink-0" style={{ color: "var(--primary)" }} />
                    <span className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>ケース数</span>
                  </div>
                </th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-center" style={{ borderLeft: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-center gap-2 lg:gap-4">
                    <Database className="w-5 lg:w-6 h-5 lg:h-6 flex-shrink-0" style={{ color: "var(--primary)" }} />
                    <span className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>総レコード</span>
                  </div>
                </th>
                <th className="px-4 lg:px-6 py-3 lg:py-4 text-center" style={{ borderLeft: "1px solid var(--border)" }}>
                  <div className="flex items-center justify-center gap-2 lg:gap-4">
                    <CheckCircle className="w-5 lg:w-6 h-5 lg:h-6 flex-shrink-0" style={{ color: "var(--primary)" }} />
                    <span className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>状態</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="px-4 lg:px-6 py-3 lg:py-4 text-center">
                  <span className="text-lg lg:text-2xl font-black" style={{ color: "#323232" }}>{stats.length}</span>
                </td>
                <td className="px-4 lg:px-6 py-3 lg:py-4 text-center" style={{ borderLeft: "1px solid var(--border)" }}>
                  <span className="text-lg lg:text-2xl font-black" style={{ color: "#323232" }}>{totalCount.toLocaleString()}</span>
                </td>
                <td className="px-4 lg:px-6 py-3 lg:py-4 text-center" style={{ borderLeft: "1px solid var(--border)" }}>
                  <span className="text-lg lg:text-2xl font-black" style={{ color: "#323232" }}>
                    {totalCount > 0 ? "稼働中" : "待機中"}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* データセット一覧 */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="px-4 lg:px-6 py-3 lg:py-4 border-b" style={{ borderColor: "var(--border)" }}>
            <h2 className="text-base lg:text-lg font-black" style={{ color: "#323232" }}>
              データセット一覧
            </h2>
          </div>
          <AdminDatasetList initialStats={stats} />
        </div>
      </div>
    </DashboardLayout>
  );
}
