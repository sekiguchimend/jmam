// Surfaceカードコンポーネント
// 使用箇所: mfaClient, CreateUserInline, PredictClient

interface SurfaceCardProps {
  children: React.ReactNode;
  className?: string;
  padding?: "none" | "sm" | "md" | "lg";
}

export function SurfaceCard({ children, className = "", padding = "md" }: SurfaceCardProps) {
  const paddingStyles = {
    none: "",
    sm: "p-3",
    md: "p-4",
    lg: "p-6",
  };

  return (
    <div
      className={`rounded-xl ${paddingStyles[padding]} ${className}`}
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      {children}
    </div>
  );
}
