// フォーム入力コンポーネント
// 使用箇所: SetupForm, mfaClient, CreateUserInline

import { forwardRef } from "react";

interface FormInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  required?: boolean;
  variant?: "default" | "setup";
}

export const FormInput = forwardRef<HTMLInputElement, FormInputProps>(
  ({ label, required, variant = "default", className = "", ...props }, ref) => {
    const variantStyles = {
      default: {
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "#323232",
      },
      setup: {
        border: "2px solid #e5e5e5",
        background: "#fff",
        color: "#323232",
      },
    };

    return (
      <div>
        {label && (
          <label
            className="block text-sm font-bold mb-2"
            style={{ color: "#323232" }}
          >
            {label} {required && <span style={{ color: "#dc2626" }}>*</span>}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full px-4 py-3 rounded-xl text-base font-bold transition-all ${className}`}
          style={variantStyles[variant]}
          {...props}
        />
      </div>
    );
  }
);

FormInput.displayName = "FormInput";
