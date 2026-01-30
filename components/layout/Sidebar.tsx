"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logout } from "@/actions/auth";
import { useTransition, memo, ReactNode } from "react";
import { LayoutGrid, Lightbulb, Database, Upload, LogOut, Loader2, X, Users, FileQuestion, Sparkles, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";

// 個別のナビアイテム - 自分のアクティブ状態が変わった時だけ再レンダリング
const NavItem = memo(function NavItem({
  href,
  icon,
  name,
  collapsed,
  onClose,
  exactMatch = false,
}: {
  href: string;
  icon: ReactNode;
  name: string;
  collapsed?: boolean;
  onClose?: () => void;
  exactMatch?: boolean;
}) {
  const pathname = usePathname();
  const isActive = exactMatch
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      onClick={onClose}
      className={`flex items-center rounded-lg transition-all duration-200 ${collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5"}`}
      style={{
        background: isActive ? "var(--sidebar-active)" : "transparent",
        color: isActive ? "#fff" : "var(--text-muted)",
      }}
      title={collapsed ? name : undefined}
    >
      {icon}
      {!collapsed && <span className="font-bold whitespace-nowrap">{name}</span>}
    </Link>
  );
});

interface SidebarProps {
  isAdmin: boolean;
  userName?: string | null;
  userEmail?: string;
  isOpen?: boolean;
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({ isAdmin, userName, userEmail, isOpen, onClose, collapsed, onToggleCollapse }: SidebarProps) {
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
      href: "/dashboard/new-case-predict",
      icon: <Sparkles className="w-5 h-5" />,
    },
    {
      name: "使い方",
      href: "/dashboard/help",
      icon: <BookOpen className="w-5 h-5" />,
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
          fixed left-0 top-0 h-full flex flex-col z-50
          lg:translate-x-0
          ${isOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{
          background: "var(--sidebar)",
          width: collapsed ? "80px" : "256px",
          transition: "width 0.3s ease-in-out, transform 0.3s ease-in-out",
          boxShadow: "4px 0 16px rgba(0, 0, 0, 0.15)",
        }}
      >
        {/* ロゴ */}
        <div
          className="p-4 border-b flex items-center"
          style={{
            borderColor: "var(--sidebar-border)",
            justifyContent: collapsed ? "center" : "space-between",
          }}
        >
          {!collapsed && (
            <Link href="/dashboard" onClick={handleNavClick}>
              <Image src="/jlogo.png" alt="JMAM" width={120} height={48} />
            </Link>
          )}
          {/* デスクトップ用開閉ボタン */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: "var(--text-muted)" }}
          >
            {collapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          </button>
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
        <nav className={`flex-1 ${collapsed ? "p-2" : "p-4"} space-y-1 overflow-y-auto overflow-x-hidden`}>
          <div className="mb-4">
            {!collapsed && (
              <p className="px-3 text-xs font-black uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                メニュー
              </p>
            )}
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  icon={item.icon}
                  name={item.name}
                  collapsed={collapsed}
                  onClose={handleNavClick}
                  exactMatch={item.href === "/dashboard"}
                />
              ))}
            </div>
          </div>

          {isAdmin && (
            <div className="pt-4 border-t" style={{ borderColor: "var(--sidebar-border)" }}>
              {!collapsed && (
                <p className="px-3 text-xs font-black uppercase tracking-wider mb-2" style={{ color: "var(--text-muted)" }}>
                  管理者
                </p>
              )}
              <div className="space-y-2">
                {adminItems.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    icon={item.icon}
                    name={item.name}
                    collapsed={collapsed}
                    onClose={handleNavClick}
                    exactMatch={item.href === "/admin"}
                  />
                ))}
              </div>
            </div>
          )}
        </nav>

        {/* ユーザー情報 */}
        <div className={`${collapsed ? "p-2" : "p-4"} border-t`} style={{ borderColor: "var(--sidebar-border)" }}>
          <Link
            href="/dashboard/profile"
            onClick={handleNavClick}
            className={`flex items-center mb-3 rounded-lg transition-all duration-200 hover:bg-white/10 ${collapsed ? "justify-center p-2" : "gap-3 p-2 -mx-2"}`}
            title={collapsed ? (userName || "プロフィール") : undefined}
          >
            <div
              className={`rounded-full flex items-center justify-center font-black flex-shrink-0 ${collapsed ? "w-10 h-10 text-sm" : "w-10 h-10 text-sm"}`}
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              {(userName || userEmail || "U").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold truncate" style={{ color: "var(--text-inverse)" }}>
                  {userName || "ユーザー"}
                </p>
                <p className="text-xs font-bold truncate" style={{ color: "var(--text-muted)" }}>
                  {isAdmin ? "管理者" : "一般ユーザー"}
                </p>
              </div>
            )}
          </Link>
          <button
            onClick={handleLogout}
            disabled={isPending}
            className={`w-full flex items-center justify-center rounded-lg text-sm font-bold transition-all duration-200 disabled:opacity-50 ${collapsed ? "p-3" : "gap-2 px-3 py-2"}`}
            style={{
              background: "var(--sidebar-hover)",
              color: "var(--text-inverse)",
            }}
            title={collapsed ? "ログアウト" : undefined}
          >
            {isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <LogOut className="w-4 h-4" />
            )}
            {!collapsed && "ログアウト"}
          </button>
        </div>
      </aside>
    </>
  );
}
