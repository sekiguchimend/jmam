// アラートメッセージコンポーネント（エラー/成功）
// 使用箇所: QuestionsClient, ScorePredictClient, NewCasePredictClient, PredictClient, mfaClient

import { AlertCircle, CheckCircle } from "lucide-react";

interface AlertMessageProps {
  type: "error" | "success";
  message: string;
  className?: string;
}

export function AlertMessage({ type, message, className = "" }: AlertMessageProps) {
  const styles = {
    error: {
      background: "var(--error-light)",
      color: "var(--error)",
    },
    success: {
      background: "#dcfce7",
      color: "#16a34a",
    },
  };

  const Icon = type === "error" ? AlertCircle : CheckCircle;

  return (
    <div
      className={`p-4 rounded-xl flex items-center gap-3 ${className}`}
      style={styles[type]}
    >
      <Icon className="w-5 h-5 flex-shrink-0" />
      <span className="font-bold text-sm">{message}</span>
    </div>
  );
}

// 個別のエクスポートも提供
export function ErrorMessage({ message, className = "" }: { message: string; className?: string }) {
  return <AlertMessage type="error" message={message} className={className} />;
}

export function SuccessMessage({ message, className = "" }: { message: string; className?: string }) {
  return <AlertMessage type="success" message={message} className={className} />;
}
