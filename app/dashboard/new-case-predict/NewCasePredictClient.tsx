"use client";

import { useState, useTransition } from "react";
import { submitAnswerForNewCasePrediction, submitAnswerForExistingCasePrediction } from "@/actions/predictScoreNewCase";
import type { NewCaseScorePrediction } from "@/lib/scoring";
import {
  AlertCircle,
  Calculator,
  FileText,
  FolderOpen,
  Lightbulb,
  Loader2,
  MapPin,
  Plus,
  Send,
  TrendingUp,
} from "lucide-react";

interface Case {
  case_id: string;
  case_name: string | null;
  situation_text: string | null;
}

interface NewCasePredictClientProps {
  cases: Case[];
}

type CaseMode = "existing" | "new";

export function NewCasePredictClient({ cases }: NewCasePredictClientProps) {
  const [caseMode, setCaseMode] = useState<CaseMode>("existing");
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [situationText, setSituationText] = useState("");
  const [q1Answer, setQ1Answer] = useState("");
  const [q2Answer, setQ2Answer] = useState("");
  const [q1Result, setQ1Result] = useState<NewCaseScorePrediction | null>(null);
  const [q2Result, setQ2Result] = useState<NewCaseScorePrediction | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedCase = cases.find((c) => c.case_id === selectedCaseId);

  // モード切替時にリセット
  const handleModeChange = (mode: CaseMode) => {
    setCaseMode(mode);
    setSelectedCaseId("");
    setSituationText("");
    setQ1Answer("");
    setQ2Answer("");
    setQ1Result(null);
    setQ2Result(null);
    setError(null);
  };

  // ケース選択時
  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    const selected = cases.find((c) => c.case_id === caseId);
    setSituationText(selected?.situation_text || "");
    setQ1Result(null);
    setQ2Result(null);
    setError(null);
  };

  const handleSubmit = async (question: "q1" | "q2") => {
    const answerText = question === "q1" ? q1Answer : q2Answer;

    // バリデーション
    if (caseMode === "existing") {
      if (!selectedCaseId) {
        setError("ケースを選択してください");
        return;
      }
    } else {
      if (!situationText.trim()) {
        setError("ケース内容（シチュエーション）を入力してください");
        return;
      }
      if (situationText.trim().length < 20) {
        setError("ケース内容は20文字以上入力してください");
        return;
      }
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
      let response;
      
      if (caseMode === "existing") {
        // 既存ケースの場合
        response = await submitAnswerForExistingCasePrediction({
          caseId: selectedCaseId,
          question,
          answerText: answerText.trim(),
        });
      } else {
        // 新規ケースの場合
        response = await submitAnswerForNewCasePrediction({
          situationText: situationText.trim(),
          question,
          answerText: answerText.trim(),
        });
      }

      if (response.success && response.prediction) {
        if (question === "q1") {
          setQ1Result(response.prediction);
        } else {
          setQ2Result(response.prediction);
        }
      } else {
        setError(response.error ?? "スコア予測に失敗しました");
      }
    });
  };

  // 予測ボタンの有効/無効判定
  const isSubmitDisabled = (question: "q1" | "q2") => {
    const answerText = question === "q1" ? q1Answer : q2Answer;
    
    if (isPending) return true;
    if (!answerText.trim() || answerText.trim().length < 10) return true;
    
    if (caseMode === "existing") {
      return !selectedCaseId;
    } else {
      return !situationText.trim() || situationText.trim().length < 20;
    }
  };

  return (
    <div className="space-y-6">
      {/* モード切替（コンパクトスイッチ） */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-bold" style={{ color: "#323232" }}>ケース:</span>
        <div
          className="inline-flex rounded-lg p-0.5"
          style={{ background: "var(--border)" }}
        >
          <button
            onClick={() => handleModeChange("existing")}
            className="px-3 py-1.5 rounded-md text-xs font-black transition-all"
            style={{
              background: caseMode === "existing" ? "#fff" : "transparent",
              color: caseMode === "existing" ? "var(--primary)" : "var(--text-muted)",
              boxShadow: caseMode === "existing" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
          >
            既存
          </button>
          <button
            onClick={() => handleModeChange("new")}
            className="px-3 py-1.5 rounded-md text-xs font-black transition-all"
            style={{
              background: caseMode === "new" ? "#fff" : "transparent",
              color: caseMode === "new" ? "#6366f1" : "var(--text-muted)",
              boxShadow: caseMode === "new" ? "0 1px 2px rgba(0,0,0,0.1)" : "none",
            }}
          >
            新規
          </button>
        </div>
      </div>

      {/* 既存ケースモード: ケース選択 */}
      {caseMode === "existing" && (
        <div
          className="rounded-xl p-5"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "var(--primary)" }}
            >
              <FolderOpen className="w-4 h-4 text-white" />
            </div>
            <label className="text-sm font-black" style={{ color: "#323232" }}>
              ケースを選択
            </label>
          </div>
          <select
            value={selectedCaseId}
            onChange={(e) => handleCaseSelect(e.target.value)}
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

          {/* シチュエーション表示（読み取り専用） */}
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
      )}

      {/* 新規ケースモード: シチュエーション入力 */}
      {caseMode === "new" && (
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: "#6366f1" }}
            >
              <FileText className="w-4 h-4 text-white" />
            </div>
            <label className="text-sm font-black" style={{ color: "#323232" }}>
              ケース内容（シチュエーション）を入力
            </label>
          </div>
          <textarea
            value={situationText}
            onChange={(e) => {
              setSituationText(e.target.value);
              setError(null);
              setQ1Result(null);
              setQ2Result(null);
            }}
            placeholder="新しいケースのシチュエーション（状況説明）を入力してください...&#10;例：あなたは〇〇部門の課長です。部下に△△という問題が発生しています..."
            rows={8}
            className="w-full px-4 py-3 rounded-lg text-sm font-bold resize-none"
            style={{
              border: "1px solid var(--border)",
              background: "var(--background)",
              color: "#323232",
            }}
          />
          <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
            {situationText.length} / 20文字以上
          </p>
        </div>
      )}

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
            disabled={isSubmitDisabled("q1")}
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
          value={q1Answer}
          onChange={(e) => {
            setQ1Answer(e.target.value);
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
          {q1Answer.length} / 10文字以上
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
            disabled={isSubmitDisabled("q2")}
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
          value={q2Answer}
          onChange={(e) => {
            setQ2Answer(e.target.value);
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
          {q2Answer.length} / 10文字以上
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
      {q1Result && !isPending && (
        <PredictionResult
          title="設問1の予測結果"
          result={q1Result}
          showSimilarCases={caseMode === "new"}
        />
      )}

      {/* 設問2の結果 */}
      {q2Result && !isPending && (
        <PredictionResult
          title="設問2の予測結果"
          result={q2Result}
          showSimilarCases={caseMode === "new"}
        />
      )}

      {/* 説明 */}
      <div
        className="rounded-xl p-5"
        style={{ background: "#f5f5f5" }}
      >
        <h3 className="text-sm font-black mb-2" style={{ color: "#323232" }}>
          スコア予測について
        </h3>
        <ul className="text-sm space-y-2" style={{ color: "var(--text-muted)" }}>
          {caseMode === "existing" ? (
            <>
              <li>• 選択したケースの過去回答データから類似回答を検索します</li>
              <li>• 類似回答のスコアを基に、入力された回答のスコアを予測します</li>
            </>
          ) : (
            <>
              <li>• 入力されたシチュエーションから、類似の既存ケースを自動検索します</li>
              <li>• 類似ケースの回答データを基に、入力された回答のスコアを予測します</li>
              <li>• 類似度が高いケースが見つかるほど、予測の信頼度が向上します</li>
              <li>• ケースのシチュエーションが登録されていない場合は検索できません</li>
            </>
          )}
        </ul>
      </div>
    </div>
  );
}

// 予測結果表示コンポーネント
function PredictionResult({
  title,
  result,
  showSimilarCases = true,
}: {
  title: string;
  result: NewCaseScorePrediction;
  showSimilarCases?: boolean;
}) {
  return (
    <div className="space-y-4">
      <h3 className="text-base font-black" style={{ color: "#323232" }}>
        {title}
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
                {result.predictedScore.toFixed(1)}
              </span>
              <span className="text-lg font-bold" style={{ color: "var(--text-muted)" }}>
                / 5.0
              </span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                信頼度: {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 類似ケース（新規モードのみ表示） */}
      {showSimilarCases && result.similarCases && result.similarCases.length > 0 && (
        <div
          className="p-5"
          style={{ background: "transparent" }}
        >
          <div className="flex items-start gap-3 mb-4">
            <MapPin className="w-5 h-5 flex-shrink-0" style={{ color: "#6366f1" }} />
            <h3 className="text-sm font-black" style={{ color: "#323232" }}>
              類似ケース（上位{result.similarCases.length}件）
            </h3>
          </div>
          <div className="space-y-2" style={{ marginLeft: "32px" }}>
            {result.similarCases.map((c, index) => (
              <div
                key={c.caseId}
                className="p-3 rounded-lg flex items-center justify-between"
                style={{ background: "#fff" }}
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                    #{index + 1}
                  </span>
                  <span className="text-sm font-bold" style={{ color: "#323232" }}>
                    {c.caseName || c.caseId}
                  </span>
                </div>
                <span
                  className="text-xs font-black px-2 py-1 rounded"
                  style={{ background: "#6366f1", color: "#fff" }}
                >
                  類似度 {(c.similarity * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

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
          {result.explanation}
        </p>
      </div>

      {/* 類似例 */}
      {result.similarExamples.length > 0 && (
        <div
          className="p-5"
          style={{ background: "transparent" }}
        >
          <div className="flex items-start gap-3 mb-4">
            <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-black" style={{ color: "#323232" }}>
              類似回答例（上位{result.similarExamples.length}件）
            </h3>
          </div>
          <div className="space-y-3" style={{ marginLeft: "32px" }}>
            {result.similarExamples.map((example, index) => (
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
  );
}
