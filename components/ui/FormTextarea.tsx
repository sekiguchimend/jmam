// フォームテキストエリアコンポーネント
// 使用箇所: QuestionsClient, ScorePredictClient, NewCasePredictClient

import { forwardRef } from "react";

interface FormTextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  icon?: React.ReactNode;
  hint?: string;
  charCount?: number;
  minChars?: number;
}

export const FormTextarea = forwardRef<HTMLTextAreaElement, FormTextareaProps>(
  ({ label, icon, hint, charCount, minChars, className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              {icon}
              <label className="text-sm font-black" style={{ color: "#323232" }}>
                {label}
              </label>
            </div>
            {charCount !== undefined && (
              <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                {charCount} {minChars ? `/ ${minChars}文字以上` : "文字"}
              </span>
            )}
          </div>
        )}
        <textarea
          ref={ref}
          className={`w-full px-4 py-3 rounded-lg text-sm font-bold resize-none ${className}`}
          style={{
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "#323232",
          }}
          {...props}
        />
        {hint && (
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {hint}
          </p>
        )}
      </div>
    );
  }
);

FormTextarea.displayName = "FormTextarea";
