// ローディングスピナーコンポーネント
// 使用箇所: mfaClient, ScorePredictClient, NewCasePredictClient, QuestionsClient

import { Loader2 } from "lucide-react";

interface LoadingSpinnerProps {
  text?: string;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LoadingSpinner({ text, size = "md", className = "" }: LoadingSpinnerProps) {
  const sizeStyles = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-6 h-6",
  };

  return (
    <span className={`flex items-center justify-center gap-2 ${className}`}>
      <Loader2 className={`animate-spin ${sizeStyles[size]}`} />
      {text && <span className="font-bold">{text}</span>}
    </span>
  );
}

// ページローディング用
export function PageLoading({ text = "読み込み中..." }: { text?: string }) {
  return (
    <div className="flex items-center justify-center py-8">
      <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
      <span className="ml-2 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
        {text}
      </span>
    </div>
  );
}
