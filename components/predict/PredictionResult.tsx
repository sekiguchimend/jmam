// 予測結果表示コンポーネント
// FR-04: 生成された予測回答を分かりやすく表示

import { Card } from '@/components/ui';
import type { PredictionResponse } from '@/types';

interface PredictionResultProps {
  prediction: PredictionResponse | null;
  isLoading?: boolean;
}

export function PredictionResult({ prediction, isLoading }: PredictionResultProps) {
  if (isLoading) {
    return (
      <Card title="予測結果">
        <div className="text-[#323232]">予測中...</div>
      </Card>
    );
  }

  if (!prediction) {
    return null;
  }

  return (
    <Card title="予測結果">
      <div className="space-y-4 text-[#323232]">
        <div>
          <h4 className="font-bold">問題把握</h4>
          <p>{prediction.problemAnswer}</p>
        </div>
        <div>
          <h4 className="font-bold">対策立案</h4>
          <p>{prediction.solutionAnswer}</p>
        </div>
      </div>
    </Card>
  );
}
