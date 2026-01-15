"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import { useTransition } from "react";
import { LayoutGrid, Lightbulb, Database, Upload, LogOut, Loader2, X, Users, Link2, Calculator, FileQuestion } from "lucide-react";
import Image from "next/image";

interface SidebarProps {
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string;
  isOpen?: boolean;
  onClose?: () => void;
}

export function Sidebar({ isAdmin, userName, userEmail, isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    startTransition(async () => {
      await logout();
    });
  };

  const handleNavClick = () => {
    // モバイルでリンククリック時にサイドバーを閉じる
    if (onClose) onClose();
  };

  const navItems = [
    {
      name: "ダッシュボード",
      href: "/dashboard",
      icon: <LayoutGrid className="w-5 h-5" />,
    },
    {
      name: "回答予測",
      href: "/dashboard/predict",
      icon: <Lightbulb className="w-5 h-5" />,
    },
    {
      name: "スコア予測",
      href: "/dashboard/score-predict",
      icon: <Calculator className="w-5 h-5" />,
    },
  ];

  const adminItems = [
    {
      name: "学習データ",
      href: "/admin",
      icon: <Database className="w-5 h-5" />,
    },
    {
      name: "設問管理",
      href: "/admin/questions",
      icon: <FileQuestion className="w-5 h-5" />,
    },
    {
      name: "ユーザー管理",
      href: "/admin/users",
      icon: <Users className="w-5 h-5" />,
    },
    {
      name: "割り当て",
      href: "/admin/assign",
      icon: <Link2 className="w-5 h-5" />,
    },
    {
      name: "データ追加",
      href: "/admin/upload",
      icon: <Upload className="w-5 h-5" />,
    },
  ];

  return (
    <>
      {/* オーバーレイ（モバイル用） */}
      {isOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-40"
          onClick={onClose}
        />
      )}

      {/* サイドバー */}
      <aside
        className={`
          fixed left-0 top-0 h-full w-64 flex flex-col z-50
          transition-transform duration-300 ease-in-out
          lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ background: "var(--sidebar)" }}
      >
        {/* ロゴ */}
        <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: "var(--sidebar-border)" }}>
          <Link href="/dashboard" onClick={handleNavClick}>
            <Image src="/jlogo.png" alt="JMAM" width={120} height={48} />
          </Link>
          {/* モバイル用閉じるボタン */}
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded"
            style={{ color: "var(--text-muted)" }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ナビゲーション */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <div className="mb-4">
            <p className="px-3 text-xs font-black uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
              メニュー
            </p>
            <div className="space-y-2">
              {navItems.map((item) => {
                const isActive = item.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={handleNavClick}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
                    style={{
                      background: isActive ? "var(--sidebar-active)" : "transparent",
                      color: isActive ? "#fff" : "var(--text-muted)",
                    }}
                  >
                    {item.icon}
                    <span className="font-bold">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
              <p className="px-3 text-xs font-black uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                管理者
              </p>
              <div className="space-y-2">
                {adminItems.map((item) => {
                  const isActive = pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href));
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={handleNavClick}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
                      style={{
                        background: isActive ? "var(--sidebar-active)" : "transparent",
                        color: isActive ? "#fff" : "var(--text-muted)",
                      }}
                    >
                      {item.icon}
                      <span className="font-bold">{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}
        </nav>

        {/* ユーザー情報 */}
        <div className="p-4 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
          <Link
            href="/dashboard/profile"
            onClick={handleNavClick}
            className="flex items-center gap-3 mb-3 p-2 -mx-2 rounded-lg transition-all duration-200 hover:bg-white/10"
          >
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black flex-shrink-0"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {(userName || userEmail || "U").charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate" style={{ color: "var(--text-inverse)" }}>
                {userName || "ユーザー"}
              </p>
              <p className="text-xs font-bold truncate" style={{ color: "var(--text-muted)" }}>
                {isAdmin ? "管理者" : "一般ユーザー"}
              </p>
            </div>
          </Link>
          <button
            onClick={handleLogout}
            disabled={isPending}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-50"
            style={{
              background: "var(--sidebar-hover)",
              color: "var(--text-inverse)",
            }}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            ログアウト
          </button>
        </div>
      </aside>
    </>
  );
}
