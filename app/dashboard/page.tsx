// ダッシュボード（Server Component）
// ミドルウェアで認証済みなので、ここでは認証チェック不要
import { getUserWithRole } from "@/lib/supabase/server";
import { fetchCases } from "@/actions/predict";
import { fetchTotalCount, fetchDatasetStats } from "@/actions/upload";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import Link from "next/link";
import { Briefcase, Database, CheckCircle, User, Lightbulb, Upload, Inbox, ChevronRight } from "lucide-react";

export default async function DashboardPage() {
  // ミドルウェアでアクセストークンをチェック済み
  const userInfo = await getUserWithRole();

  const [cases, totalCount, stats] = await Promise.all([
    fetchCases(),
    fetchTotalCount(),
    fetchDatasetStats(),
  ]);

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
            ダッシュボード
          </h1>
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
            おかえりなさい、{userInfo.name || "ユーザー"}さん
          </p>
        </div>

        {/* 統計カード */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6 mb-6 lg:mb-8">
          <StatCard
            title="ケース数"
            value={cases.length.toString()}
            icon={<Briefcase className="w-6 h-6" />}
          />
          <StatCard
            title="総レコード数"
            value={totalCount.toLocaleString()}
            icon={<Database className="w-6 h-6" />}
          />
          <StatCard
            title="システム状態"
            value={totalCount > 0 ? "稼働中" : "待機中"}
            icon={<CheckCircle className="w-6 h-6" />}
          />
          <StatCard
            title="権限"
            value={userInfo.isAdmin ? "管理者" : "一般"}
            icon={<User className="w-6 h-6" />}
          />
        </div>

        {/* クイックアクション */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-6 mb-6 lg:mb-8">
          <Link href="/dashboard/predict" className="group">
            <div
              className="p-6 rounded-xl transition-all duration-200 hover:shadow-lg"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="flex items-start gap-4">
                <Lightbulb className="w-6 h-6 flex-shrink-0" style={{ color: "var(--primary)" }} />
                <div className="flex-1">
                  <h3 className="text-lg font-black mb-1 flex items-center gap-2" style={{ color: "#323232" }}>
                    回答予測を開始
                    <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                  </h3>
                  <p className="text-sm font-bold" style={{ color: "#323232" }}>
                    スコアを設定してAIが最適な回答を予測します
                  </p>
                </div>
              </div>
            </div>
          </Link>

          {userInfo.isAdmin && (
            <Link href="/admin/upload" className="group">
              <div
                className="p-6 rounded-xl transition-all duration-200 hover:shadow-lg"
                style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
              >
                <div className="flex items-start gap-4">
                  <Upload className="w-6 h-6 flex-shrink-0" style={{ color: "var(--primary)" }} />
                  <div className="flex-1">
                    <h3 className="text-lg font-black mb-1 flex items-center gap-2" style={{ color: "#323232" }}>
                      データをアップロード
                      <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </h3>
                    <p className="text-sm font-bold" style={{ color: "#323232" }}>
                      CSVファイルから学習データを追加します
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          )}
        </div>

        {/* データセット一覧 */}
        {stats.length > 0 && (
          <div
            className="rounded-xl overflow-hidden"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="px-4 lg:px-6 py-3 lg:py-4 border-b" style={{ borderColor: "var(--border)" }}>
              <h2 className="text-base lg:text-lg font-black" style={{ color: "#323232" }}>
                データセット概要
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[400px]">
                <thead>
                  <tr style={{ background: "var(--background)" }}>
                    <th className="px-4 lg:px-6 py-2 lg:py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: "#323232" }}>
                      ケースID
                    </th>
                    <th className="px-4 lg:px-6 py-2 lg:py-3 text-left text-xs font-black uppercase tracking-wider" style={{ color: "#323232" }}>
                      ケース名
                    </th>
                    <th className="px-4 lg:px-6 py-2 lg:py-3 text-right text-xs font-black uppercase tracking-wider" style={{ color: "#323232" }}>
                      レコード数
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y" style={{ borderColor: "var(--border)" }}>
                  {stats.slice(0, 5).map((stat) => (
                    <tr key={stat.caseId} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm font-black" style={{ color: "#323232" }}>
                        {stat.caseId}
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm font-bold" style={{ color: "#323232" }}>
                        {stat.caseName || "-"}
                      </td>
                      <td className="px-4 lg:px-6 py-3 lg:py-4 text-sm text-right font-black" style={{ color: "#323232" }}>
                        {stat.recordCount.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {stats.length > 5 && (
              <div className="px-6 py-3 border-t text-center" style={{ borderColor: "var(--border)" }}>
                <Link
                  href="/admin"
                  className="text-sm font-black hover:underline"
                  style={{ color: "var(--primary)" }}
                >
                  すべてのデータセットを見る →
                </Link>
              </div>
            )}
          </div>
        )}

        {/* データがない場合 */}
        {cases.length === 0 && (
          <div
            className="rounded-xl p-8 lg:p-12 text-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <Inbox className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
            <h3 className="text-base lg:text-lg font-black mb-2" style={{ color: "#323232" }}>
              データがありません
            </h3>
            <p className="text-sm lg:text-base mb-6 font-bold" style={{ color: "#323232" }}>
              回答予測を行うには、まずデータをアップロードしてください
            </p>
            {userInfo.isAdmin && (
              <Link
                href="/admin/upload"
                className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-black transition-all hover:shadow-lg text-white"
                style={{ background: "var(--primary)" }}
              >
                <Upload className="w-5 h-5" />
                データをアップロード
              </Link>
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
}) {
  return (
    <div
      className="p-4 lg:p-6 rounded-xl"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-center gap-3 lg:gap-4">
        <div className="flex-shrink-0 hidden sm:block" style={{ color: "var(--primary)" }}>
          {icon}
        </div>
        <div>
          <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
            {title}
          </p>
          <p className="text-lg lg:text-2xl font-black" style={{ color: "#323232" }}>
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}
