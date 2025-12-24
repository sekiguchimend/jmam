// プログレスバーコンポーネント
// FR-10: データ登録処理の進捗表示

interface ProgressBarProps {
  current: number;
  total: number;
}

export function ProgressBar({ current, total }: ProgressBarProps) {
  const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="w-full">
      <div className="flex justify-between text-sm text-[#323232] mb-1">
        <span>{percentage}%</span>
        <span>{current.toLocaleString()} / {total.toLocaleString()}</span>
      </div>
      <div className="w-full bg-gray-200 rounded-full h-4">
        <div
          className="bg-[#323232] h-4 rounded-full transition-all"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
