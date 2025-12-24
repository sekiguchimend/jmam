"use client";

import { useState, useTransition } from "react";
import { predictAnswer } from "@/actions/predict";
import type { Case, Scores, PredictionResponse } from "@/types";
import { defaultScores } from "@/types";
import { AlertCircle, ChevronRight, Lightbulb, Loader2, MessageSquare, Send, Target } from "lucide-react";

const scoreLabels = [
  { key: "problem", label: "問題把握" },
  { key: "solution", label: "対策立案" },
  { key: "role", label: "役割理解" },
  { key: "leadership", label: "主導" },
  { key: "collaboration", label: "連携" },
  { key: "development", label: "育成" },
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
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set(["problem", "solution"]));

  const toggleAccordion = (key: string) => {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

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

  return (
    <div className="space-y-6">
      {/* ケース選択 */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <label className="block text-sm font-black mb-2" style={{ color: "#323232" }}>
          ケース
        </label>
        <select
          value={selectedCaseId}
          onChange={(e) => {
            setSelectedCaseId(e.target.value);
            setResult(null);
          }}
          className="w-full px-4 py-2.5 rounded-lg text-sm font-bold appearance-none cursor-pointer"
          style={{
            border: "1px solid var(--border)",
            background: `var(--background) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23323232' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center`,
            color: "#323232",
            paddingRight: "36px",
          }}
        >
          <option value="">選択してください</option>
          {cases.map((c) => (
            <option key={c.case_id} value={c.case_id}>
              {c.case_name || c.case_id}
            </option>
          ))}
        </select>

        {selectedCase?.situation_text && (
          <div className="mt-4 p-4 rounded-lg" style={{ background: "var(--background)" }}>
            <p className="text-xs font-black mb-1" style={{ color: "var(--text-muted)" }}>
              シチュエーション
            </p>
            <p className="text-sm leading-relaxed" style={{ color: "#323232" }}>
              {selectedCase.situation_text}
            </p>
          </div>
        )}
      </div>

      {/* 目標スコア設定 - テーブル形式 */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <label className="block text-sm font-black mb-3" style={{ color: "#323232" }}>
          目標スコア
        </label>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" style={{ minWidth: "500px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)" }}>
                {scoreLabels.map(({ label }) => (
                  <th
                    key={label}
                    className="pb-2 text-center font-bold"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                {scoreLabels.map(({ key }) => (
                  <td key={key} className="pt-3 px-1">
                    <input
                      type="number"
                      min="1.0"
                      max="4.0"
                      step="0.1"
                      value={scores[key]}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val) && val >= 1.0 && val <= 4.0) {
                          handleScoreChange(key, val);
                        }
                      }}
                      className="w-full text-center py-2 rounded-lg font-bold text-sm"
                      style={{
                        border: "1px solid var(--border)",
                        background: "var(--background)",
                        color: "#323232",
                      }}
                    />
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          1.0〜4.0の範囲で入力
        </p>
      </div>

      {/* 実行ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handlePredict}
          disabled={!selectedCaseId || isPending}
          className="px-6 py-2.5 rounded-lg text-sm font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
          style={{ background: "var(--primary)" }}
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              予測中...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              予測を実行
            </>
          )}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: "var(--error-light)", color: "var(--error)" }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {/* 結果 - アコーディオン形式 */}
      {result && !isPending && (
        <div className="space-y-3">
          {/* 問題把握 */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: openAccordions.has("problem") ? "1px solid var(--primary)" : "1px solid var(--border)",
              transition: "border-color 0.2s ease",
            }}
          >
            <button
              onClick={() => toggleAccordion("problem")}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: openAccordions.has("problem") ? "var(--primary)" : "var(--background)" }}
              >
                <Target
                  className="w-4 h-4"
                  style={{ color: openAccordions.has("problem") ? "#fff" : "var(--text-muted)" }}
                />
              </div>
              <span className="text-sm font-black flex-1" style={{ color: "#323232" }}>
                問題把握
              </span>
              <ChevronRight
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: "var(--text-muted)",
                  transform: openAccordions.has("problem") ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{
                maxHeight: openAccordions.has("problem") ? "1000px" : "0",
                opacity: openAccordions.has("problem") ? 1 : 0,
              }}
            >
              <div
                className="px-4 pb-4 pt-0"
                style={{ marginLeft: "44px" }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                  {result.problemAnswer}
                </p>
              </div>
            </div>
          </div>

          {/* 対策立案 */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: openAccordions.has("solution") ? "1px solid var(--primary)" : "1px solid var(--border)",
              transition: "border-color 0.2s ease",
            }}
          >
            <button
              onClick={() => toggleAccordion("solution")}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: openAccordions.has("solution") ? "var(--primary)" : "var(--background)" }}
              >
                <MessageSquare
                  className="w-4 h-4"
                  style={{ color: openAccordions.has("solution") ? "#fff" : "var(--text-muted)" }}
                />
              </div>
              <span className="text-sm font-black flex-1" style={{ color: "#323232" }}>
                対策立案
              </span>
              <ChevronRight
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: "var(--text-muted)",
                  transform: openAccordions.has("solution") ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{
                maxHeight: openAccordions.has("solution") ? "1000px" : "0",
                opacity: openAccordions.has("solution") ? 1 : 0,
              }}
            >
              <div
                className="px-4 pb-4 pt-0"
                style={{ marginLeft: "44px" }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                  {result.solutionAnswer}
                </p>
              </div>
            </div>
          </div>

          {/* 理由 */}
          {(result.problemReason || result.solutionReason) && (
            <div
              className="rounded-xl overflow-hidden"
              style={{
                background: "var(--surface)",
                border: openAccordions.has("reason") ? "1px solid var(--primary)" : "1px solid var(--border)",
                transition: "border-color 0.2s ease",
              }}
            >
              <button
                onClick={() => toggleAccordion("reason")}
                className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
              >
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: openAccordions.has("reason") ? "var(--primary)" : "var(--background)" }}
                >
                  <Lightbulb
                    className="w-4 h-4"
                    style={{ color: openAccordions.has("reason") ? "#fff" : "var(--text-muted)" }}
                  />
                </div>
                <span className="text-sm font-black flex-1" style={{ color: "#323232" }}>
                  予測の理由
                </span>
                <ChevronRight
                  className="w-4 h-4 transition-transform duration-200"
                  style={{
                    color: "var(--text-muted)",
                    transform: openAccordions.has("reason") ? "rotate(90deg)" : "rotate(0deg)",
                  }}
                />
              </button>
              <div
                className="overflow-hidden transition-all duration-200"
                style={{
                  maxHeight: openAccordions.has("reason") ? "2000px" : "0",
                  opacity: openAccordions.has("reason") ? 1 : 0,
                }}
              >
                <div
                  className="px-4 pb-4 pt-0 space-y-4"
                  style={{ marginLeft: "44px" }}
                >
                  {result.problemReason && (
                    <div>
                      <p className="text-xs font-bold mb-1.5" style={{ color: "var(--primary)" }}>
                        問題把握について
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                        {result.problemReason}
                      </p>
                    </div>
                  )}
                  {result.solutionReason && (
                    <div>
                      <p className="text-xs font-bold mb-1.5" style={{ color: "var(--primary)" }}>
                        対策立案について
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                        {result.solutionReason}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
