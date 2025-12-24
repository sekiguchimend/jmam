// プログレスバーコンポーネント
// FR-10: データ登録処理の進捗表示

interface ProgressBarProps {
  current: number;
  total: number;
  animated?: boolean;
}

export function ProgressBar({ current, total, animated = false }: ProgressBarProps) {
  const percentageRaw = total > 0 ? Math.round((current / total) * 100) : 0;
  const percentage = Math.max(0, Math.min(100, percentageRaw));

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-[#323232] mb-1">
        <span>{percentage}%</span>
        <span>{current.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
        <div className="relative h-4 rounded-full" style={{ width: `${percentage}%` }}>
          <div className="bg-[#323232] h-4 rounded-full transition-all" />
          {animated && percentage > 0 && percentage < 100 && (
            <div className="absolute inset-0 overflow-hidden">
              <div className="progressbar-shimmer absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
            </div>
          )}
        </div>
      </div>
      {animated && (
        <style jsx>{`
          .progressbar-shimmer {
            animation: progressbar-shimmer 1.2s linear infinite;
          }
          @keyframes progressbar-shimmer {
            0% {
              transform: translateX(-20%);
            }
            100% {
              transform: translateX(220%);
            }
          }
        `}</style>
      )}
    </div>
  );
}
