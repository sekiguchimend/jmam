"use client";

import { useState, useTransition } from "react";
import { submitCombinedPrediction, submitCombinedNewCasePrediction, type CombinedPredictionResult } from "@/actions/predictScoreNewCase";
import type { ScoreItems } from "@/lib/scoring";
import {
  AlertCircle,
  Calculator,
  FileText,
  FolderOpen,
  Lightbulb,
  Loader2,
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
  const [result, setResult] = useState<CombinedPredictionResult | null>(null);
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
    setResult(null);
    setError(null);
  };

  // ケース選択時
  const handleCaseSelect = (caseId: string) => {
    setSelectedCaseId(caseId);
    const selected = cases.find((c) => c.case_id === caseId);
    setSituationText(selected?.situation_text || "");
    setResult(null);
    setError(null);
  };

  // 統合予測を実行
  const handleSubmit = async () => {
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

    if (!q1Answer.trim()) {
      setError("設問1の回答を入力してください");
      return;
    }

    if (q1Answer.trim().length < 10) {
      setError("設問1の回答は10文字以上入力してください");
      return;
    }

    if (!q2Answer.trim()) {
      setError("設問2の回答を入力してください");
      return;
    }

    if (q2Answer.trim().length < 10) {
      setError("設問2の回答は10文字以上入力してください");
      return;
    }

    setError(null);
    startTransition(async () => {
      let response;
      
      if (caseMode === "existing") {
        // 既存ケースの場合
        response = await submitCombinedPrediction({
          caseId: selectedCaseId,
          q1Answer: q1Answer.trim(),
          q2Answer: q2Answer.trim(),
        });
      } else {
        // 新規ケースの場合
        response = await submitCombinedNewCasePrediction({
          situationText: situationText.trim(),
          q1Answer: q1Answer.trim(),
          q2Answer: q2Answer.trim(),
        });
      }

      if (response.success && response.result) {
        setResult(response.result);
      } else {
        setError(response.error ?? "スコア予測に失敗しました");
      }
    });
  };

  // 予測ボタンの有効/無効判定
  const isSubmitDisabled = () => {
    if (isPending) return true;
    if (!q1Answer.trim() || q1Answer.trim().length < 10) return true;
    if (!q2Answer.trim() || q2Answer.trim().length < 10) return true;
    
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
        <label className="text-sm font-black mb-3 block" style={{ color: "#323232" }}>
          設問1の回答（問題把握）
        </label>
        <textarea
          value={q1Answer}
          onChange={(e) => {
            setQ1Answer(e.target.value);
            setError(null);
            setResult(null);
          }}
          placeholder="設問1の回答を入力してください...&#10;（職場の問題点を挙げてください）"
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
        <label className="text-sm font-black mb-3 block" style={{ color: "#323232" }}>
          設問2の回答（対策立案・主導・連携・育成）
        </label>
        <textarea
          value={q2Answer}
          onChange={(e) => {
            setQ2Answer(e.target.value);
            setError(null);
            setResult(null);
          }}
          placeholder="設問2の回答を入力してください...&#10;（問題に対する対策と実行計画を示してください）"
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

      {/* 予測ボタン */}
      <div className="px-5">
        <button
          onClick={handleSubmit}
          disabled={isSubmitDisabled()}
          className="w-full px-6 py-4 rounded-xl text-base font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center justify-center gap-3"
          style={{ background: "var(--primary)" }}
        >
          {isPending ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              予測中...
            </>
          ) : (
            <>
              <Calculator className="w-5 h-5" />
              スコアを予測する
            </>
          )}
        </button>
      </div>

      {/* エラー */}
      {error && (
        <div
          className="p-4 rounded-xl flex items-center gap-3 mx-5"
          style={{ background: "var(--error-light)", color: "var(--error)" }}
        >
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm">{error}</span>
        </div>
      )}

      {/* 統合予測結果 */}
      {result && !isPending && (
        <CombinedPredictionResultView result={result} />
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
          <li>• 設問1と設問2の両方の回答を入力して「スコアを予測する」を押してください</li>
          <li>• 設問1からは「問題把握」を、設問2からは「対策立案・主導・連携・育成」を評価します</li>
          <li>• 総合評点は5項目の平均で算出されます</li>
          {caseMode === "new" && (
            <li>• 新規ケースの場合、類似の既存ケースから回答データを参照します</li>
          )}
        </ul>
      </div>
    </div>
  );
}

// 統合予測結果表示コンポーネント
function CombinedPredictionResultView({
  result,
}: {
  result: CombinedPredictionResult;
}) {
  return (
    <div className="space-y-4 px-5">
      <h3 className="text-base font-black" style={{ color: "#323232" }}>
        予測結果
      </h3>

      {/* 予測スコアと信頼度 */}
      <div
        className="p-6 rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-4 mb-4">
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
            
            {/* 総合スコア（大きく表示） */}
            {result.predictedScores.overall != null && (
              <div className="p-4 rounded-lg mb-4" style={{ background: "var(--primary)", color: "#fff" }}>
                <p className="text-xs font-bold mb-1 opacity-80">総合評点</p>
                <p className="text-4xl font-black">
                  {result.predictedScores.overall.toFixed(1)}
                </p>
              </div>
            )}
            
            {/* 個別スコア */}
            <div className="grid grid-cols-5 gap-2">
              {result.predictedScores.problem != null && (
                <div className="p-2 rounded-lg text-center" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>問題把握</p>
                  <p className="text-lg font-black" style={{ color: "var(--primary)" }}>
                    {result.predictedScores.problem.toFixed(1)}
                  </p>
                </div>
              )}
              {result.predictedScores.solution != null && (
                <div className="p-2 rounded-lg text-center" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>対策立案</p>
                  <p className="text-lg font-black" style={{ color: "var(--primary)" }}>
                    {result.predictedScores.solution.toFixed(1)}
                  </p>
                </div>
              )}
              {result.predictedScores.leadership != null && (
                <div className="p-2 rounded-lg text-center" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>主導</p>
                  <p className="text-lg font-black" style={{ color: "var(--primary)" }}>
                    {result.predictedScores.leadership.toFixed(1)}
                  </p>
                </div>
              )}
              {result.predictedScores.collaboration != null && (
                <div className="p-2 rounded-lg text-center" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>連携</p>
                  <p className="text-lg font-black" style={{ color: "var(--primary)" }}>
                    {result.predictedScores.collaboration.toFixed(1)}
                  </p>
                </div>
              )}
              {result.predictedScores.development != null && (
                <div className="p-2 rounded-lg text-center" style={{ background: "var(--background)" }}>
                  <p className="text-xs font-bold mb-1" style={{ color: "var(--text-muted)" }}>育成</p>
                  <p className="text-lg font-black" style={{ color: "var(--primary)" }}>
                    {result.predictedScores.development.toFixed(1)}
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2 mt-4">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                信頼度: {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 説明 */}
      <div
        className="p-5 rounded-xl"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-start gap-3 mb-3">
          <Lightbulb className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-black" style={{ color: "#323232" }}>
            予測の説明
          </h3>
        </div>
        <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232", marginLeft: "32px" }}>
          {result.combinedExplanation}
        </div>
      </div>
    </div>
  );
}
