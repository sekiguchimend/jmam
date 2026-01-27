// グラデーションボタンコンポーネント
// 使用箇所: QuestionsClient, ScorePredictClient, NewCasePredictClient, dashboard/page, AdminDatasetList

"use client";

import { Loader2 } from "lucide-react";

interface GradientButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isLoading?: boolean;
  loadingText?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  size?: "sm" | "md" | "lg";
}

export function GradientButton({
  isLoading = false,
  loadingText = "処理中...",
  icon,
  children,
  size = "md",
  className = "",
  disabled,
  ...props
}: GradientButtonProps) {
  const sizeStyles = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base",
  };

  return (
    <button
      className={`font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center justify-center gap-2 ${sizeStyles[size]} ${className}`}
      style={{
        background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
        borderRadius: "5px",
      }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" />
          {loadingText}
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  );
}
