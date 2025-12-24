"use client";

import { useState, useTransition } from "react";
import { predictAnswer } from "@/actions/predict";
import type { Case, Scores, PredictionResponse } from "@/types";
import { defaultScores } from "@/types";
import { ClipboardList, SlidersHorizontal, AlertCircle, Lightbulb, Loader2, Zap, Search, ClipboardCheck, Info } from "lucide-react";

const scoreLabels = [
  { key: "problem", label: "問題把握", description: "問題を正確に理解し分析する力" },
  { key: "solution", label: "対策立案", description: "効果的な解決策を立案する力" },
  { key: "role", label: "役割理解", description: "自身の役割を理解し遂行する力" },
  { key: "leadership", label: "主導", description: "チームを率いて成果を出す力" },
  { key: "collaboration", label: "連携", description: "他者と協力して目標を達成する力" },
  { key: "development", label: "育成", description: "メンバーの成長を支援する力" },
] as const;

interface PredictClientProps {
  cases: Case[];
}

export function PredictClient({ cases }: PredictClientProps) {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [scores, setScores] = useState<Scores>(defaultScores);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCase = cases.find((c) => c.case_id === selectedCaseId);

  const handleScoreChange = (key: keyof Scores, value: number) => {
    setScores((prev) => ({ ...prev, [key]: value }));
  };

  const handlePredict = () => {
    if (!selectedCaseId) {
      setError("ケースを選択してください");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await predictAnswer(selectedCaseId, scores);
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
        setResult(null);
      }
    });
  };

  const averageScore = Object.values(scores).reduce((a, b) => a + b, 0) / 6;

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 lg:gap-6">
      {/* 左側: 設定パネル */}
      <div className="xl:col-span-1 space-y-4 lg:space-y-6">
        {/* ケース選択 */}
        <div
          className="rounded-xl p-4 lg:p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <h2 className="text-base lg:text-lg font-black mb-3 lg:mb-4 flex items-center gap-2" style={{ color: "#323232" }}>
            <ClipboardList className="w-5 h-5" />
            ケース選択
          </h2>
          <select
            value={selectedCaseId}
            onChange={(e) => setSelectedCaseId(e.target.value)}
            className="w-full px-4 py-3 rounded-lg text-base font-bold transition-all cursor-pointer"
            style={{
              border: "1px solid var(--border)",
              background: "var(--surface)",
              color: "#323232",
            }}
          >
            <option value="">ケースを選択...</option>
            {cases.map((c) => (
              <option key={c.case_id} value={c.case_id}>
                {c.case_name || c.case_id}
              </option>
            ))}
          </select>

          {/* シチュエーション表示 */}
          {selectedCase?.situation_text && (
            <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--background)" }}>
              <p className="text-xs font-black uppercase tracking-wider mb-2" style={{ color: "#323232" }}>
                シチュエーション
              </p>
              <p className="text-sm leading-relaxed font-bold" style={{ color: "#323232" }}>
                {selectedCase.situation_text}
              </p>
            </div>
          )}
        </div>

        {/* スコア設定 */}
        <div
          className="rounded-xl p-4 lg:p-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-3 lg:mb-4">
            <h2 className="text-base lg:text-lg font-black flex items-center gap-2" style={{ color: "#323232" }}>
              <SlidersHorizontal className="w-5 h-5" />
              目標スコア
            </h2>
            <div
              className="px-3 py-1 rounded-full text-sm font-black text-white"
              style={{ background: "var(--primary)" }}
            >
              平均 {averageScore.toFixed(1)}
            </div>
          </div>

          <div className="space-y-4 lg:space-y-5">
            {scoreLabels.map(({ key, label, description }) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="text-sm font-black" style={{ color: "#323232" }}>
                      {label}
                    </span>
                    <p className="text-xs font-bold hidden sm:block" style={{ color: "#323232" }}>
                      {description}
                    </p>
                  </div>
                  <span
                    className="text-sm font-black px-2 py-1 rounded-md min-w-[48px] text-center text-white"
                    style={{ background: "var(--primary)" }}
                  >
                    {scores[key].toFixed(1)}
                  </span>
                </div>
                <input
                  type="range"
                  min="1.0"
                  max="4.0"
                  step="0.1"
                  value={scores[key]}
                  onChange={(e) => handleScoreChange(key, parseFloat(e.target.value))}
                  className="w-full"
                />
                <div className="flex justify-between text-xs mt-1 font-bold" style={{ color: "#323232" }}>
                  <span>1.0</span>
                  <span>4.0</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 予測実行ボタン */}
        <button
          onClick={handlePredict}
          disabled={!selectedCaseId || isPending}
          className="w-full py-4 rounded-xl font-black text-base transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:shadow-lg active:scale-[0.98] text-white"
          style={{ background: "var(--primary)" }}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              AIが予測中...
            </span>
          ) : (
            <span className="flex items-center justify-center gap-2">
              <Zap className="w-5 h-5" />
              予測を実行
            </span>
          )}
        </button>
      </div>

      {/* 右側: 結果表示 */}
      <div className="xl:col-span-2">
        {error && (
          <div
            className="p-4 rounded-xl mb-6 flex items-center gap-3 animate-slide-up font-bold"
            style={{ background: "var(--error-light)", color: "#323232" }}
          >
            <AlertCircle className="w-5 h-5 flex-shrink-0" />
            {error}
          </div>
        )}

        {!result && !isPending && (
          <div
            className="rounded-xl p-8 lg:p-12 min-h-[200px] lg:min-h-[500px] flex items-center justify-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-center">
              <Lightbulb className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4 lg:mb-6" style={{ color: "var(--text-muted)" }} />
              <h3 className="text-lg lg:text-xl font-black mb-2" style={{ color: "#323232" }}>
                予測結果がここに表示されます
              </h3>
              <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
                ケースを選択し、スコアを設定して<br />
                「予測を実行」をクリックしてください
              </p>
            </div>
          </div>
        )}

        {isPending && (
          <div
            className="rounded-xl p-8 lg:p-12 min-h-[200px] lg:min-h-[500px] flex items-center justify-center"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="text-center">
              <Loader2 className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4 lg:mb-6 animate-spin" style={{ color: "var(--primary)" }} />
              <h3 className="text-lg lg:text-xl font-black mb-2" style={{ color: "#323232" }}>
                AIが回答を生成中...
              </h3>
              <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
                しばらくお待ちください
              </p>
            </div>
          </div>
        )}

        {result && !isPending && (
          <div className="space-y-4 lg:space-y-6 animate-slide-up">
            {/* スコアサマリー */}
            <div
              className="rounded-xl p-4 lg:p-6"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <h3 className="text-xs lg:text-sm font-black uppercase tracking-wider mb-3 lg:mb-4" style={{ color: "#323232" }}>
                入力スコア
              </h3>
              <div className="flex flex-wrap gap-2 lg:gap-3">
                {scoreLabels.map(({ key, label }) => (
                  <div
                    key={key}
                    className="px-3 lg:px-4 py-1.5 lg:py-2 rounded-lg"
                    style={{ background: "var(--background)" }}
                  >
                    <span className="text-xs font-bold" style={{ color: "#323232" }}>{label}</span>
                    <span className="ml-1 lg:ml-2 font-black" style={{ color: "#323232" }}>
                      {scores[key].toFixed(1)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 問題把握 */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-2 lg:gap-3 text-white" style={{ background: "var(--primary)" }}>
                <Search className="w-4 lg:w-5 h-4 lg:h-5" />
                <h3 className="text-sm lg:text-base font-black">問題把握</h3>
              </div>
              <div className="p-4 lg:p-6">
                <p className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap font-bold" style={{ color: "#323232" }}>
                  {result.problemAnswer}
                </p>
              </div>
            </div>

            {/* 対策立案 */}
            <div
              className="rounded-xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-2 lg:gap-3 text-white" style={{ background: "var(--primary)" }}>
                <ClipboardCheck className="w-4 lg:w-5 h-4 lg:h-5" />
                <h3 className="text-sm lg:text-base font-black">対策立案</h3>
              </div>
              <div className="p-4 lg:p-6">
                <p className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap font-bold" style={{ color: "#323232" }}>
                  {result.solutionAnswer}
                </p>
              </div>
            </div>

            {/* 理由 */}
            {(() => {
              const reasonText = [
                result.problemReason ? `【問題把握】\n${result.problemReason}` : null,
                result.solutionReason ? `【対策立案】\n${result.solutionReason}` : null,
              ]
                .filter(Boolean)
                .join("\n\n");

              if (!reasonText) return null;
              return (
                <div
                  className="rounded-xl overflow-hidden"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="px-4 lg:px-6 py-3 lg:py-4 flex items-center gap-2 lg:gap-3 text-white" style={{ background: "var(--info)" }}>
                    <Info className="w-4 lg:w-5 h-4 lg:h-5" />
                    <h3 className="text-sm lg:text-base font-black">予測の理由</h3>
                  </div>
                  <div className="p-4 lg:p-6">
                    <p className="text-sm lg:text-base leading-relaxed whitespace-pre-wrap font-bold" style={{ color: "#323232" }}>
                      {reasonText}
                    </p>
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
