// シチュエーション表示コンポーネント
// 使用箇所: ScorePredictClient, NewCasePredictClient, PredictClient

interface SituationDisplayProps {
  text: string;
  label?: string;
  className?: string;
}

export function SituationDisplay({ text, label = "シチュエーション", className = "" }: SituationDisplayProps) {
  return (
    <div
      className={`mt-4 p-4 rounded-lg ${className}`}
      style={{ background: "var(--background)" }}
    >
      <p className="text-xs font-black mb-1" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-sm leading-relaxed" style={{ color: "#323232" }}>
        {text}
      </p>
    </div>
  );
}
