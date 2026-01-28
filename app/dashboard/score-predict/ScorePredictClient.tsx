"use client";

import { useState, useTransition, useMemo } from "react";
import { submitAnswerForScorePrediction } from "@/actions/predictScore";
import type { ScorePrediction, ScoreItems } from "@/lib/scoring";
import {
  FormSelect,
  FormTextarea,
  GradientButton,
  ErrorMessage,
  SituationDisplay,
} from "@/components/ui";
import {
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

  const selectedCase = useMemo(
    () => cases.find((c) => c.case_id === selectedCaseId),
    [cases, selectedCaseId]
  );

  const caseOptions = cases.map((c) => ({
    value: c.case_id,
    label: c.case_name || c.case_id,
  }));

  return (
    <div className="space-y-6">
      {/* ケース選択 */}
      <div className="p-5">
        <FormSelect
          label="ケース"
          options={caseOptions}
          value={selectedCaseId}
          onChange={(e) => {
            setSelectedCaseId(e.target.value);
            setProblemResult(null);
            setSolutionResult(null);
            setError(null);
          }}
        />

        {selectedCase?.situation_text && (
          <SituationDisplay text={selectedCase.situation_text} />
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
          <GradientButton
            onClick={() => handleSubmit("q1")}
            disabled={!selectedCaseId || !problemAnswer.trim() || problemAnswer.trim().length < 10 || isPending}
            isLoading={isPending}
            loadingText="予測中..."
            icon={<Send className="w-3 h-3" />}
            size="sm"
          >
            予測
          </GradientButton>
        </div>
        <FormTextarea
          value={problemAnswer}
          onChange={(e) => {
            setProblemAnswer(e.target.value);
            setError(null);
          }}
          placeholder="設問1の回答を入力してください..."
          rows={6}
          hint={`${problemAnswer.length} / 10文字以上`}
        />
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
          <GradientButton
            onClick={() => handleSubmit("q2")}
            disabled={!selectedCaseId || !solutionAnswer.trim() || solutionAnswer.trim().length < 10 || isPending}
            isLoading={isPending}
            loadingText="予測中..."
            icon={<Send className="w-3 h-3" />}
            size="sm"
          >
            予測
          </GradientButton>
        </div>
        <FormTextarea
          value={solutionAnswer}
          onChange={(e) => {
            setSolutionAnswer(e.target.value);
            setError(null);
          }}
          placeholder="設問2の回答を入力してください..."
          rows={6}
          hint={`${solutionAnswer.length} / 10文字以上`}
        />
      </div>

      {/* エラー */}
      {error && <ErrorMessage message={error} />}

      {/* 設問1の結果 */}
      {problemResult && !isPending && (
        <PredictionResultView title="設問1の予測結果" result={problemResult} />
      )}

      {/* 設問2の結果 */}
      {solutionResult && !isPending && (
        <PredictionResultView title="設問2の予測結果" result={solutionResult} />
      )}
    </div>
  );
}

// 予測結果表示コンポーネント
function PredictionResultView({
  title,
  result,
}: {
  title: string;
  result: ScorePrediction;
}) {
  return (
    <div className="space-y-4 px-5">
      <h3 className="text-base font-black" style={{ color: "#323232" }}>
        {title}
      </h3>

      {/* 予測スコア一覧 */}
      <div className="p-6" style={{ background: "transparent" }}>
        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--primary)" }}
          >
            <Calculator className="w-6 h-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-black mb-2" style={{ color: "#323232" }}>
              予測スコア
            </h3>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: "var(--text-muted)" }} />
              <span className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
                信頼度: {(result.confidence * 100).toFixed(0)}%
              </span>
            </div>
          </div>
        </div>

        {/* スコア階層構造（ツリー形式） */}
        <ScoreTreeView scores={result.predictedScores} />
      </div>

      {/* 説明 */}
      <div className="p-5" style={{ background: "transparent" }}>
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
        <div className="p-5" style={{ background: "transparent" }}>
          <div className="flex items-start gap-3 mb-4">
            <FileText className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
            <h3 className="text-sm font-black" style={{ color: "#323232" }}>
              類似回答例（上位{result.similarExamples.length}件）
            </h3>
          </div>
          <div className="space-y-3" style={{ marginLeft: "32px" }}>
            {result.similarExamples.map((example, index) => (
              <div key={example.responseId} className="p-4 rounded-lg" style={{ background: "#fff" }}>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-black" style={{ color: "var(--text-muted)" }}>
                    #{index + 1}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                      類似度: {(example.similarity * 100).toFixed(0)}%
                    </span>
                    <span className="text-sm font-black" style={{ color: "var(--primary)" }}>
                      問題把握{example.scores.problem?.toFixed(1) ?? "-"}点
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

// スコアツリービューコンポーネント
function ScoreTreeView({ scores }: { scores: Partial<ScoreItems> }) {
  // 役割理解は主導・連携・育成の平均として自動計算
  const calculatedRole = useMemo(() => {
    if (scores.leadership != null && scores.collaboration != null && scores.development != null) {
      const avg = (scores.leadership + scores.collaboration + scores.development) / 3;
      return Math.round(avg * 10) / 10;
    }
    return null;
  }, [scores.leadership, scores.collaboration, scores.development]);

  return (
    <div className="p-4 rounded-lg" style={{ background: "#fafafa", maxWidth: "600px" }}>
      <div style={{ marginLeft: "8px", fontFamily: "inherit" }}>
        {/* 問題把握 */}
        {scores.problem != null && (
          <ScoreTreeNode
            label="問題把握"
            value={scores.problem}
            isLast={false}
            children={[
              scores.problemUnderstanding != null && { label: "状況理解", value: scores.problemUnderstanding },
              scores.problemEssence != null && { label: "本質把握", value: scores.problemEssence },
              scores.problemMaintenanceBiz != null && { label: "維持・業務", value: scores.problemMaintenanceBiz },
              scores.problemMaintenanceHr != null && { label: "維持・人", value: scores.problemMaintenanceHr },
              scores.problemReformBiz != null && { label: "改革・業務", value: scores.problemReformBiz },
              scores.problemReformHr != null && { label: "改革・人", value: scores.problemReformHr },
            ].filter(Boolean) as { label: string; value: number }[]}
          />
        )}

        {/* 対策立案 */}
        {scores.solution != null && (
          <ScoreTreeNode
            label="対策立案"
            value={scores.solution}
            isLast={false}
            children={[
              scores.solutionCoverage != null && { label: "網羅性", value: scores.solutionCoverage },
              scores.solutionPlanning != null && { label: "計画性", value: scores.solutionPlanning },
              scores.solutionMaintenanceBiz != null && { label: "維持・業務", value: scores.solutionMaintenanceBiz },
              scores.solutionMaintenanceHr != null && { label: "維持・人", value: scores.solutionMaintenanceHr },
              scores.solutionReformBiz != null && { label: "改革・業務", value: scores.solutionReformBiz },
              scores.solutionReformHr != null && { label: "改革・人", value: scores.solutionReformHr },
            ].filter(Boolean) as { label: string; value: number }[]}
          />
        )}

        {/* 役割理解（自動計算） */}
        {calculatedRole != null && (
          <ScoreTreeNode label="役割理解" value={calculatedRole} isLast={false} isCalculated />
        )}

        {/* 主導 */}
        {scores.leadership != null && (
          <ScoreTreeNode label="主導" value={scores.leadership} isLast={false} />
        )}

        {/* 連携 */}
        {scores.collaboration != null && (
          <ScoreTreeNode
            label="連携"
            value={scores.collaboration}
            isLast={false}
            children={[
              scores.collabSupervisor != null && { label: "上司", value: scores.collabSupervisor },
              scores.collabExternal != null && { label: "職場外", value: scores.collabExternal },
              scores.collabMember != null && { label: "メンバー", value: scores.collabMember },
            ].filter(Boolean) as { label: string; value: number }[]}
          />
        )}

        {/* 育成 */}
        {scores.development != null && (
          <ScoreTreeNode label="育成" value={scores.development} isLast={true} />
        )}
      </div>
    </div>
  );
}

// スコアツリーノードコンポーネント
function ScoreTreeNode({
  label,
  value,
  isLast,
  children = [],
  isCalculated = false,
}: {
  label: string;
  value: number;
  isLast: boolean;
  children?: { label: string; value: number }[];
  isCalculated?: boolean;
}) {
  return (
    <div className="relative" style={{ paddingLeft: "62px" }}>
      <div
        className="absolute w-px"
        style={{ background: "#cbd5e1", left: 0, top: 0, bottom: isLast ? "32px" : 0 }}
      />
      <div
        className="absolute h-px"
        style={{ background: "#cbd5e1", left: "1px", top: "32px", width: "60px" }}
      />
      <div className="flex items-center" style={{ height: "64px" }}>
        <span className="font-black text-[20px]" style={{ color: "#6366f1" }}>
          {label}
          {isCalculated && (
            <span className="text-[12px] font-bold ml-2" style={{ color: "var(--text-muted)" }}>
              (自動計算)
            </span>
          )}
        </span>
        <span className="font-black text-[24px] ml-4" style={{ color: "#6366f1" }}>
          {value.toFixed(1)}
        </span>
      </div>

      {children.length > 0 && (
        <div className="relative" style={{ paddingLeft: "62px" }}>
          <div
            className="absolute w-px"
            style={{ background: "#cbd5e1", left: 0, top: 0, bottom: "32px" }}
          />
          {children.map((child, index) => (
            <div key={child.label} className="relative flex items-center" style={{ height: "64px" }}>
              <div
                className="absolute h-px"
                style={{ background: "#cbd5e1", left: "-62px", top: "50%", width: "52px", zIndex: 0 }}
              />
              <span
                className="text-[16px] font-bold relative"
                style={{ color: "#64748b", zIndex: 1 }}
              >
                {child.label}
              </span>
              <span
                className="text-[18px] font-bold ml-4 relative"
                style={{ color: "#323232", zIndex: 1 }}
              >
                {child.value}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
