"use client";

import { useState, useTransition, useCallback, useMemo, memo } from "react";
import { submitCombinedPrediction, submitCombinedNewCasePrediction, type CombinedPredictionResult } from "@/actions/predictScoreNewCase";
import type { ScoreItems } from "@/lib/scoring";
import {
  FormSelect,
  FormTextarea,
  GradientButton,
  ErrorMessage,
  SituationDisplay,
} from "@/components/ui";
import {
  Calculator,
  Download,
  FileText,
  FolderOpen,
  Lightbulb,
  Loader2,
  Send,
  TrendingUp,
} from "lucide-react";
import { exportNewCasePredictToPdf } from "@/lib/pdf-export";

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
  const [isExporting, setIsExporting] = useState(false);

  const selectedCase = useMemo(
    () => cases.find((c) => c.case_id === selectedCaseId),
    [cases, selectedCaseId]
  );

  // モード切替時にリセット
  const handleModeChange = useCallback((mode: CaseMode) => {
    setCaseMode(mode);
    setSelectedCaseId("");
    setSituationText("");
    setQ1Answer("");
    setQ2Answer("");
    setResult(null);
    setError(null);
  }, []);

  // ケース選択時
  const handleCaseSelect = useCallback((caseId: string) => {
    setSelectedCaseId(caseId);
    const selected = cases.find((c) => c.case_id === caseId);
    setSituationText(selected?.situation_text || "");
    setResult(null);
    setError(null);
  }, [cases]);

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
      setError("設問1の解答を入力してください");
      return;
    }

    if (q1Answer.trim().length < 10) {
      setError("設問1の解答は10文字以上入力してください");
      return;
    }

    if (!q2Answer.trim()) {
      setError("設問2の解答を入力してください");
      return;
    }

    if (q2Answer.trim().length < 10) {
      setError("設問2の解答は10文字以上入力してください");
      return;
    }

    setError(null);
    startTransition(async () => {
      let response;

      if (caseMode === "existing") {
        response = await submitCombinedPrediction({
          caseId: selectedCaseId,
          q1Answer: q1Answer.trim(),
          q2Answer: q2Answer.trim(),
        });
      } else {
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

  const caseOptions = useMemo(
    () => cases.map((c) => ({ value: c.case_id, label: c.case_name || c.case_id })),
    [cases]
  );

  // PDF出力
  const handleExportPdf = async () => {
    if (!result) return;

    setIsExporting(true);
    try {
      const caseName = caseMode === "existing"
        ? (selectedCase?.case_name || selectedCaseId)
        : "新規ケース";
      const situation = caseMode === "existing"
        ? (selectedCase?.situation_text ?? "")
        : situationText;
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      // スコアデータを整形
      const scores = result.predictedScores;
      const scoreData: { label: string; value: number; children?: { label: string; value: number }[] }[] = [];

      if (scores.problem != null) {
        scoreData.push({
          label: "問題把握",
          value: scores.problem,
          children: [
            scores.problemUnderstanding != null && { label: "状況理解", value: scores.problemUnderstanding },
            scores.problemEssence != null && { label: "本質把握", value: scores.problemEssence },
            scores.problemMaintenanceBiz != null && { label: "維持管理・業務", value: scores.problemMaintenanceBiz },
            scores.problemMaintenanceHr != null && { label: "維持管理・人", value: scores.problemMaintenanceHr },
            scores.problemReformBiz != null && { label: "改革・業務", value: scores.problemReformBiz },
            scores.problemReformHr != null && { label: "改革・人", value: scores.problemReformHr },
          ].filter(Boolean) as { label: string; value: number }[],
        });
      }

      if (scores.solution != null) {
        scoreData.push({
          label: "対策立案",
          value: scores.solution,
          children: [
            scores.solutionCoverage != null && { label: "網羅性", value: scores.solutionCoverage },
            scores.solutionPlanning != null && { label: "計画性", value: scores.solutionPlanning },
            scores.solutionMaintenanceBiz != null && { label: "維持管理・業務", value: scores.solutionMaintenanceBiz },
            scores.solutionMaintenanceHr != null && { label: "維持管理・人", value: scores.solutionMaintenanceHr },
            scores.solutionReformBiz != null && { label: "改革・業務", value: scores.solutionReformBiz },
            scores.solutionReformHr != null && { label: "改革・人", value: scores.solutionReformHr },
          ].filter(Boolean) as { label: string; value: number }[],
        });
      }

      if (scores.role != null) {
        scoreData.push({ label: "役割理解", value: scores.role });
      }

      if (scores.leadership != null) {
        scoreData.push({ label: "主導", value: scores.leadership });
      }

      if (scores.collaboration != null) {
        scoreData.push({
          label: "連携",
          value: scores.collaboration,
          children: [
            scores.collabSupervisor != null && { label: "上司", value: scores.collabSupervisor },
            scores.collabExternal != null && { label: "職場外", value: scores.collabExternal },
            scores.collabMember != null && { label: "メンバー", value: scores.collabMember },
          ].filter(Boolean) as { label: string; value: number }[],
        });
      }

      if (scores.development != null) {
        scoreData.push({ label: "育成", value: scores.development });
      }

      // 総合スコアを計算して追加（役割理解・対策立案・問題把握の平均）
      if (scores.role != null && scores.solution != null && scores.problem != null) {
        const overallScore = Math.round(((scores.role + scores.solution + scores.problem) / 3) * 10) / 10;
        scoreData.push({ label: "総合スコア", value: overallScore });
      }

      await exportNewCasePredictToPdf(
        {
          caseName,
          situationText: situation,
          q1Answer,
          q2Answer,
          confidence: result.confidence,
          scores: scoreData,
          explanation: result.combinedExplanation,
        },
        `スコア予測_${caseName}_${timestamp}`
      );
    } catch (err) {
      console.error("PDF export failed:", err);
      setError("PDFの出力に失敗しました");
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* モード切替 */}
      <div className="flex items-center justify-between gap-3 px-5">
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
        <GradientButton
          onClick={handleSubmit}
          disabled={isSubmitDisabled()}
          isLoading={isPending}
          loadingText="予測中..."
          icon={<Send className="w-4 h-4" />}
          className="flex-shrink-0"
        >
          スコアを予測する
        </GradientButton>
      </div>

      {/* 既存ケースモード: ケース選択 */}
      {caseMode === "existing" && (
        <div className="p-5">
          <FormSelect
            label="ケースを選択"
            icon={<FolderOpen className="w-5 h-5 flex-shrink-0" style={{ color: "#323232" }} />}
            options={caseOptions}
            value={selectedCaseId}
            onChange={(e) => handleCaseSelect(e.target.value)}
          />

          {selectedCase?.situation_text && (
            <SituationDisplay text={selectedCase.situation_text} />
          )}
        </div>
      )}

      {/* 新規ケースモード: シチュエーション入力 */}
      {caseMode === "new" && (
        <div className="p-5">
          <FormTextarea
            label="ケース内容（シチュエーション）を入力"
            icon={<FileText className="w-5 h-5 flex-shrink-0" style={{ color: "#323232" }} />}
            value={situationText}
            onChange={(e) => {
              setSituationText(e.target.value);
              if (error) setError(null);
              if (result) setResult(null);
            }}
            placeholder="新しいケースのシチュエーション（状況説明）を入力してください...&#10;例：あなたは〇〇部門の課長です。部下に△△という問題が発生しています..."
            rows={8}
            hint={`${situationText.length} / 20文字以上`}
          />
        </div>
      )}

      {/* 設問1の解答入力 */}
      <div className="p-5" style={{ background: "transparent" }}>
        <FormTextarea
          label="設問1の解答（問題把握）"
          value={q1Answer}
          onChange={(e) => {
            setQ1Answer(e.target.value);
            if (error) setError(null);
            if (result) setResult(null);
          }}
          placeholder="設問1の解答を入力してください...&#10;（職場の問題点を挙げてください）"
          rows={6}
          hint={`${q1Answer.length} / 10文字以上`}
        />
      </div>

      {/* 設問2の解答入力 */}
      <div className="p-5" style={{ background: "transparent" }}>
        <FormTextarea
          label="設問2の解答（対策立案・主導・連携・育成）"
          value={q2Answer}
          onChange={(e) => {
            setQ2Answer(e.target.value);
            if (error) setError(null);
            if (result) setResult(null);
          }}
          placeholder="設問2の解答を入力してください...&#10;（問題に対する対策と実行計画を示してください）"
          rows={6}
          hint={`${q2Answer.length} / 10文字以上`}
        />
      </div>

      {/* エラー */}
      {error && <ErrorMessage message={error} className="mx-5" />}

      {/* 統合予測結果 */}
      {result && !isPending && (
        <div>
          <div className="flex justify-end px-5 mb-2">
            <button
              onClick={handleExportPdf}
              disabled={isExporting}
              className="flex items-center gap-1.5 text-sm font-bold transition-opacity hover:opacity-70 disabled:opacity-50"
              style={{ color: "var(--primary)" }}
            >
              {isExporting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              PDF出力 →
            </button>
          </div>
          <CombinedPredictionResultView result={result} />
        </div>
      )}

      {/* 説明 */}
      <div className="rounded-xl p-5" style={{ background: "#f5f5f5" }}>
        <h3 className="text-sm font-black mb-2" style={{ color: "#323232" }}>
          スコア予測について
        </h3>
        <ul className="text-sm space-y-2" style={{ color: "var(--text-muted)" }}>
          <li>• 設問1と設問2の両方の解答を入力して「スコアを予測する」を押してください</li>
          <li>• 設問1からは「問題把握」を、設問2からは「対策立案・主導・連携・育成」を評価します</li>
          <li>• 総合評点は5項目の平均で算出されます</li>
          {caseMode === "new" && (
            <li>• 新規ケースの場合、類似の既存ケースから解答データを参照します</li>
          )}
        </ul>
      </div>
    </div>
  );
}

// 統合予測結果表示コンポーネント（memo化でパフォーマンス改善）
const CombinedPredictionResultView = memo(function CombinedPredictionResultView({ result }: { result: CombinedPredictionResult }) {
  return (
    <div className="space-y-4 px-5">
      <h3 className="text-base font-black" style={{ color: "#323232" }}>
        予測結果
      </h3>

      {/* 予測スコアと信頼度 */}
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

        <ScoreTreeView scores={result.predictedScores} />

        {/* エンベディング予測スコア（参考値） */}
        {result.embeddingScores && (
          <div className="mt-4 p-3 rounded-lg" style={{ background: "var(--background)", border: "1px dashed var(--border)" }}>
            <p className="text-xs font-bold mb-2" style={{ color: "var(--text-muted)" }}>
              参考: エンベディング予測値{result.isNewCase && '（別ケースからの参照）'}
            </p>
            <div className="grid grid-cols-6 gap-1">
              {result.embeddingScores.problem != null && (
                <EmbeddingScoreItem label="問題" value={result.embeddingScores.problem} />
              )}
              {result.embeddingScores.solution != null && (
                <EmbeddingScoreItem label="対策" value={result.embeddingScores.solution} />
              )}
              {result.embeddingScores.role != null && (
                <EmbeddingScoreItem label="役割" value={result.embeddingScores.role} />
              )}
              {result.embeddingScores.leadership != null && (
                <EmbeddingScoreItem label="主導" value={result.embeddingScores.leadership} />
              )}
              {result.embeddingScores.collaboration != null && (
                <EmbeddingScoreItem label="連携" value={result.embeddingScores.collaboration} />
              )}
              {result.embeddingScores.development != null && (
                <EmbeddingScoreItem label="育成" value={result.embeddingScores.development} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* 説明 */}
      <div className="p-5" style={{ background: "transparent" }}>
        <div className="flex items-start gap-3 mb-3">
          <Lightbulb className="w-5 h-5 flex-shrink-0" style={{ color: "var(--primary)" }} />
          <h3 className="text-sm font-black" style={{ color: "#323232" }}>
            予測の説明
          </h3>
        </div>
        <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232", marginLeft: "32px" }}>
          {result.combinedExplanation}
        </p>
      </div>
    </div>
  );
});

// エンベディングスコアアイテム（memo化でパフォーマンス改善）
const EmbeddingScoreItem = memo(function EmbeddingScoreItem({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center">
      <p className="text-[10px]" style={{ color: "var(--text-muted)" }}>{label}</p>
      <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
        {value.toFixed(1)}
      </p>
    </div>
  );
});

// スコアツリービューコンポーネント（memo化でパフォーマンス改善）
const ScoreTreeView = memo(function ScoreTreeView({ scores }: { scores: Partial<ScoreItems> }) {
  // 総合スコアを計算（役割理解・対策立案・問題把握の平均）
  const overallScore = (scores.role != null && scores.solution != null && scores.problem != null)
    ? Math.round(((scores.role + scores.solution + scores.problem) / 3) * 10) / 10
    : null;

  return (
    <div className="p-4 rounded-lg" style={{ background: "#fafafa", maxWidth: "600px" }}>
      {/* 総合スコアを目立つ位置に表示 */}
      {overallScore != null && (
        <div
          className="mb-4 p-3 rounded-lg flex items-center justify-center gap-4"
          style={{ background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)", width: "50%" }}
        >
          <span className="font-black text-[18px] text-white">総合スコア</span>
          <div className="flex items-center gap-2">
            <span className="font-black text-[28px] text-white">{overallScore.toFixed(1)}</span>
            <span className="text-[18px] text-white/70">/5</span>
          </div>
        </div>
      )}
      <div style={{ marginLeft: "8px", fontFamily: "inherit" }}>
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
        {scores.role != null && <ScoreTreeNode label="役割理解" value={scores.role} isLast={false} />}
        {scores.leadership != null && <ScoreTreeNode label="主導" value={scores.leadership} isLast={false} />}
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
        {scores.development != null && <ScoreTreeNode label="育成" value={scores.development} isLast={true} />}
      </div>
    </div>
  );
});

// スコアツリーノードコンポーネント（memo化でパフォーマンス改善）
const ScoreTreeNode = memo(function ScoreTreeNode({
  label,
  value,
  isLast,
  children = [],
}: {
  label: string;
  value: number;
  isLast: boolean;
  children?: { label: string; value: number }[];
}) {
  const hasChildren = children.length > 0;

  return (
    <div className="relative" style={{ paddingLeft: "50px" }}>
      {/* 縦線（上から親項目の中央まで、そして次の兄弟or子へ） */}
      <div
        className="absolute w-0.5"
        style={{
          background: "#cbd5e1",
          left: 0,
          top: 0,
          height: isLast && !hasChildren ? "20px" : "100%",
        }}
      />
      {/* 横線（縦線から親項目へ） - 親項目の中央(20px)で接続 */}
      <div
        className="absolute h-0.5"
        style={{ background: "#cbd5e1", left: "1px", top: "20px", width: "48px" }}
      />
      {/* 親項目 */}
      <div className="flex items-center" style={{ height: "40px" }}>
        <span className="font-black text-[18px]" style={{ color: "#6366f1" }}>{label}</span>
        <span className="font-black text-[22px] ml-3" style={{ color: "#6366f1" }}>{value.toFixed(1)}</span>
      </div>

      {/* 子項目をテーブル形式で表示（ツリー線で紐づけ） */}
      {hasChildren && (
        <div className="relative pb-2" style={{ marginLeft: "38px" }}>
          {/* 縦線（「題」の右横あたりから下へ） */}
          <div
            className="absolute w-0.5"
            style={{ background: "#cbd5e1", left: 0, top: "1px", height: "26px" }}
          />
          {/* 横線（縦線からテーブルへ） */}
          <div
            className="absolute h-0.5"
            style={{ background: "#cbd5e1", left: "0px", top: "26px", width: "19px" }}
          />
          <table
            className="rounded"
            style={{ marginLeft: "20px", border: "1px solid #cbd5e1", borderSpacing: 0 }}
          >
            <thead>
              <tr style={{ background: "#f1f5f9", borderBottom: "1px solid #cbd5e1" }}>
                {children.map((child) => (
                  <th
                    key={child.label}
                    className="px-2 py-1 text-[10px] font-bold text-center"
                    style={{ color: "#64748b", borderRight: "1px solid #cbd5e1" }}
                  >
                    {child.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr style={{ background: "#fff" }}>
                {children.map((child) => (
                  <td
                    key={child.label}
                    className="px-2 py-1.5 text-[14px] font-bold text-center"
                    style={{ color: "#323232", borderRight: "1px solid #cbd5e1" }}
                  >
                    {child.value}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
});
