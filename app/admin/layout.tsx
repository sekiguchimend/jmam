// 管理者向けレイアウト
// FR-06: 管理画面認証を経由した後のレイアウト

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-[#fff]">
      {children}
    </div>
  );
}

