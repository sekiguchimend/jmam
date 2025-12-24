// カードコンポーネント
// コンテンツを囲む汎用コンテナ

interface CardProps {
  title?: string;
  children: React.ReactNode;
}

export function Card({ title, children }: CardProps) {
  return (
    <div
      className="rounded-xl p-4 lg:p-6"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      {title && (
        <h3 className="text-base lg:text-lg font-black mb-3" style={{ color: "#323232" }}>
          {title}
        </h3>
      )}
      {children}
    </div>
  );
}
