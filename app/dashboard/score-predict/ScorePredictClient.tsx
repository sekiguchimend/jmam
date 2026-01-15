"use client";

import { useState, useTransition } from "react";
import { submitAnswerForScorePrediction } from "@/actions/predictScore";
import type { ScorePrediction } from "@/lib/scoring";
import {
  AlertCircle,
  Calculator,
  FileText,
  Lightbulb,
  Loader2,
  Send,
  TrendingUp,
} from "lucide-react";

interface Case {
  case_id: string;
  case_name: string | null;
  situation_text?: string | null;
}

interface ScorePredictClientProps {
  cases: Case[];
}

export function ScorePredictClient({ cases }: ScorePredictClientProps) {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [problemAnswer, setProblemAnswer] = useState("");
  const [solutionAnswer, setSolutionAnswer] = useState("");
  const [problemResult, setProblemResult] = useState<ScorePrediction | null>(null);
  const [solutionResult, setSolutionResult] = useState<ScorePrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (question: "q1" | "q2") => {
    const answerText = question === "q1" ? problemAnswer : solutionAnswer;

    if (!selectedCaseId) {
      setError("ケースを選択してください");
      return;
    }

    if (!answerText.trim()) {
      setError(`${question === "q1" ? "設問1" : "設問2"}の回答を入力してください`);
      return;
    }

    if (answerText.trim().length < 10) {
      setError("回答は10文字以上入力してください");
      return;
    }

    setError(null);
    startTransition(async () => {
      const response = await submitAnswerForScorePrediction({
        caseId: selectedCaseId,
        question,
        answerText: answerText.trim(),
      });

      if (response.success && response.prediction) {
        if (question === "q1") {
          setProblemResult(response.prediction);
        } else {
          setSolutionResult(response.prediction);
        }
      } else {
        setError(response.error ?? "スコア予測に失敗しました");
      }
    });
  };

  const selectedCase = cases.find((c) => c.case_id === selectedCaseId);

  return (
    <div className="space-y-6">
      {/* ケース選択 */}
      <div
        className="p-5"
        style={{ background: "transparent" }}
      >
        <label className="block text-sm font-black mb-2" style={{ color: "#323232" }}>
          ケース
        </label>
        <select
          value={selectedCaseId}
          onChange={(e) => {
            setSelectedCaseId(e.target.value);
            setProblemResult(null);
            setSolutionResult(null);
            setError(null);
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
              {c.case_name}
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

      {/* 設問1の回答入力 */}
      <div
        className="p-5"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-black" style={{ color: "#323232" }}>
            設問1の回答（10文字以上）
          </label>
          <button
            onClick={() => handleSubmit("q1")}
            disabled={!selectedCaseId || !problemAnswer.trim() || problemAnswer.trim().length < 10 || isPending}
            className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
            style={{ background: "var(--primary)" }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                予測中...
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                予測
              </>
            )}
          </button>
        </div>
        <textarea
          value={problemAnswer}
          onChange={(e) => {
            setProblemAnswer(e.target.value);
            setError(null);
          }}
          placeholder="設問1の回答を入力してください..."
          rows={6}
          className="w-full px-4 py-3 rounded-lg text-sm font-bold resize-none"
          style={{
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "#323232",
          }}
        />
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {problemAnswer.length} / 10文字以上
        </p>
      </div>

      {/* 設問2の回答入力 */}
      <div
        className="p-5"
        style={{ background: "transparent" }}
      >
        <div className="flex items-center justify-between mb-3">
          <label className="text-sm font-black" style={{ color: "#323232" }}>
            設問2の回答（10文字以上）
          </label>
          <button
            onClick={() => handleSubmit("q2")}
            disabled={!selectedCaseId || !solutionAnswer.trim() || solutionAnswer.trim().length < 10 || isPending}
            className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
            style={{ background: "var(--primary)" }}
          >
            {isPending ? (
              <>
                <Loader2 className="w-3 h-3 animate-spin" />
                予測中...
              </>
            ) : (
              <>
                <Send className="w-3 h-3" />
                予測
              </>
            )}
          </button>
        </div>
        <textarea
          value={solutionAnswer}
          onChange={(e) => {
            setSolutionAnswer(e.target.value);
            setError(null);
          }}
          placeholder="設問2の回答を入力してください..."
          rows={6}
          className="w-full px-4 py-3 rounded-lg text-sm font-bold resize-none"
          style={{
            border: "1px solid var(--border)",
            background: "var(--background)",
            color: "#323232",
          }}
        />
        <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
          {solutionAnswer.length} / 10文字以上
        </p>
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

      {/* 設問1の結果 */}
      {problemResult && !isPending && (
        <div className="space-y-4">
          <h3 className="text-base font-black" style={{ color: "#323232" }}>
            設問1の予測結果
          </h3>

          {/* 予測スコアと信頼度 */}
          <div
            className="p-6"
            style={{ background: "transparent" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--primary)" }}
              >
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black mb-3" style={{ color: "#323232" }}>
                  予測スコア
                </h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-black" style={{ color: "var(--primary)" }}>
                    {problemResult.predictedScore.toFixed(1)}
                  </span>
                  <span className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>
                    / 5.0
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                    信頼度: {(problemResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 説明 */}
          <div
            className="p-5"
            style={{ background: "transparent" }}
          >
            <div className="flex items-start gap-3 mb-3">
              <Lightbulb className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-black" style={{ color: "#323232" }}>
                予測の説明
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#323232", marginLeft: "32px" }}>
              {problemResult.explanation}
            </p>
          </div>

          {/* 類似例 */}
          {problemResult.similarExamples.length > 0 && (
            <div
              className="p-5"
              style={{ background: "transparent" }}
            >
              <div className="flex items-start gap-3 mb-4">
                <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                <h3 className="text-sm font-black" style={{ color: "#323232" }}>
                  類似回答例（上位{problemResult.similarExamples.length}件）
                </h3>
              </div>
              <div className="space-y-3" style={{ marginLeft: "32px" }}>
                {problemResult.similarExamples.map((example, index) => (
                  <div
                    key={example.responseId}
                    className="p-4 rounded-lg"
                    style={{ background: "#fff" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                        #{index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          類似度: {(example.similarity * 100).toFixed(0)}%
                        </span>
                        <span className="text-sm font-black" style={{ color: "var(--primary)" }}>
                          {example.score.toFixed(1)}点
                        </span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#323232" }}>
                      {example.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 設問2の結果 */}
      {solutionResult && !isPending && (
        <div className="space-y-4">
          <h3 className="text-base font-black" style={{ color: "#323232" }}>
            設問2の予測結果
          </h3>

          {/* 予測スコアと信頼度 */}
          <div
            className="p-6"
            style={{ background: "transparent" }}
          >
            <div className="flex items-start gap-4">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: "var(--primary)" }}
              >
                <Calculator className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-black mb-3" style={{ color: "#323232" }}>
                  予測スコア
                </h3>
                <div className="flex items-baseline gap-2 mb-3">
                  <span className="text-4xl font-black" style={{ color: "var(--primary)" }}>
                    {solutionResult.predictedScore.toFixed(1)}
                  </span>
                  <span className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>
                    / 5.0
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
                  <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                    信頼度: {(solutionResult.confidence * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* 説明 */}
          <div
            className="p-5"
            style={{ background: "transparent" }}
          >
            <div className="flex items-start gap-3 mb-3">
              <Lightbulb className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
              <h3 className="text-sm font-black" style={{ color: "#323232" }}>
                予測の説明
              </h3>
            </div>
            <p className="text-sm leading-relaxed" style={{ color: "#323232", marginLeft: "32px" }}>
              {solutionResult.explanation}
            </p>
          </div>

          {/* 類似例 */}
          {solutionResult.similarExamples.length > 0 && (
            <div
              className="p-5"
              style={{ background: "transparent" }}
            >
              <div className="flex items-start gap-3 mb-4">
                <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
                <h3 className="text-sm font-black" style={{ color: "#323232" }}>
                  類似回答例（上位{solutionResult.similarExamples.length}件）
                </h3>
              </div>
              <div className="space-y-3" style={{ marginLeft: "32px" }}>
                {solutionResult.similarExamples.map((example, index) => (
                  <div
                    key={example.responseId}
                    className="p-4 rounded-lg"
                    style={{ background: "#fff" }}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                        #{index + 1}
                      </span>
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                          類似度: {(example.similarity * 100).toFixed(0)}%
                        </span>
                        <span className="text-sm font-black" style={{ color: "var(--primary)" }}>
                          {example.score.toFixed(1)}点
                        </span>
                      </div>
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#323232" }}>
                      {example.excerpt}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
