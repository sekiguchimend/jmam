// プロフィールページ（Server Component）
import { getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { User, Mail, Shield, Calendar, Settings, Key } from "lucide-react";
import { DisplayNameEditor } from "./DisplayNameEditor";

export default async function ProfilePage() {
  const userInfo = await getUserWithRole();

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <div className="max-w-4xl mx-auto animate-fade-in">
        {/* ヘッダー */}
        <div className="mb-6 lg:mb-8">
          <h1 className="text-xl lg:text-2xl font-black mb-1" style={{ color: "#323232" }}>
            プロフィール
          </h1>
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
            アカウント情報の確認
          </p>
        </div>

        {/* プロフィールカード */}
        <div
          className="rounded-xl p-4 lg:p-8 mb-4 lg:mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-4 lg:gap-6 mb-6 lg:mb-8">
            {/* アバター */}
            <div
              className="w-14 lg:w-20 h-14 lg:h-20 rounded-full flex items-center justify-center text-xl lg:text-3xl font-black flex-shrink-0"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {(userInfo.name || userInfo.email || "U").charAt(0).toUpperCase()}
            </div>
            <div>
              <h2 className="text-lg lg:text-xl font-black" style={{ color: "#323232" }}>
                {userInfo.name || "ユーザー"}
              </h2>
              <p className="text-sm lg:text-base font-bold" style={{ color: "var(--text-muted)" }}>
                {userInfo.isAdmin ? "管理者アカウント" : "一般ユーザー"}
              </p>
            </div>
          </div>

          {/* 情報リスト */}
          <div className="space-y-3 lg:space-y-4">
            <InfoRow
              icon={<Mail className="w-4 lg:w-5 h-4 lg:h-5" />}
              label="メールアドレス"
              value={userInfo.email || "未設定"}
            />
            <InfoRow
              icon={<User className="w-4 lg:w-5 h-4 lg:h-5" />}
              label="表示名"
              value={<DisplayNameEditor initialName={userInfo.name} />}
            />
            <InfoRow
              icon={<Shield className="w-4 lg:w-5 h-4 lg:h-5" />}
              label="権限"
              value={userInfo.isAdmin ? "管理者" : "一般ユーザー"}
            />
            <InfoRow
              icon={<Calendar className="w-4 lg:w-5 h-4 lg:h-5" />}
              label="ユーザーID"
              value={userInfo.id || "-"}
            />
          </div>
        </div>

        {/* アクションカード */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
          <ActionCard
            icon={<Settings className="w-5 lg:w-6 h-5 lg:h-6" />}
            title="アカウント設定"
            description="表示名やプロフィール情報を変更"
            disabled
          />
          <ActionCard
            icon={<Key className="w-5 lg:w-6 h-5 lg:h-6" />}
            title="パスワード変更"
            description="ログインパスワードを更新"
            disabled
          />
        </div>

        <p className="text-center text-xs lg:text-sm font-bold mt-4 lg:mt-6" style={{ color: "var(--text-muted)" }}>
          ※ パスワード変更など一部機能は現在準備中です
        </p>
      </div>
    </DashboardLayout>
  );
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 lg:gap-4 py-2.5 lg:py-3 border-b" style={{ borderColor: "var(--border)" }}>
      <div className="flex-shrink-0" style={{ color: "var(--primary)" }}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
          {label}
        </p>
        {typeof value === "string" ? (
          <p className="text-sm lg:text-base font-bold truncate" style={{ color: "#323232" }}>
            {value}
          </p>
        ) : (
          value
        )}
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
}) {
  return (
    <div
      className={`p-4 lg:p-5 rounded-xl transition-all ${disabled ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg cursor-pointer"}`}
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start gap-3 lg:gap-4">
        <div className="flex-shrink-0" style={{ color: "var(--primary)" }}>{icon}</div>
        <div>
          <h3 className="text-sm lg:text-base font-black" style={{ color: "#323232" }}>
            {title}
          </h3>
          <p className="text-xs lg:text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
