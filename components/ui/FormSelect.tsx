// カスタムセレクトボックスコンポーネント
// 使用箇所: QuestionsClient, ScorePredictClient, NewCasePredictClient

import { forwardRef } from "react";

interface FormSelectOption {
  value: string;
  label: string;
}

interface FormSelectProps extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "children"> {
  label?: string;
  icon?: React.ReactNode;
  options: FormSelectOption[];
  placeholder?: string;
}

export const FormSelect = forwardRef<HTMLSelectElement, FormSelectProps>(
  ({ label, icon, options, placeholder = "選択してください", className = "", ...props }, ref) => {
    return (
      <div>
        {label && (
          <div className="flex items-center gap-3 mb-2">
            {icon}
            <label className="text-sm font-black" style={{ color: "#323232" }}>
              {label}
            </label>
          </div>
        )}
        <select
          ref={ref}
          className={`max-w-md px-4 py-2.5 rounded-lg text-sm font-bold appearance-none cursor-pointer ${className}`}
          style={{
            border: "1px solid var(--border)",
            background: `var(--background) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23323232' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center`,
            color: "#323232",
            paddingRight: "36px",
          }}
          {...props}
        >
          <option value="">{placeholder}</option>
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
);

FormSelect.displayName = "FormSelect";
