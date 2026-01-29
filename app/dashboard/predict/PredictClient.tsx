"use client";

import { useState, useTransition, useCallback, useMemo } from "react";
import { predictAnswer } from "@/actions/predict";
import type { Case, Scores, PredictionResponse } from "@/types";
import { defaultScores } from "@/types";
import { AlertCircle, ChevronDown, ChevronRight, Download, FolderOpen, Lightbulb, Loader2, MessageSquare, Send, Target } from "lucide-react";
import { exportAnswerPredictToPdf } from "@/lib/pdf-export";

// スコア項目の型定義
interface ScoreItemConfig {
  key: keyof Scores;
  label: string;
  description: string;
  step: number;
  max: number;
  children?: ScoreItemConfig[];
}

// 階層構造のスコア定義（総合以外すべて同じレベルで表示）
const scoreStructure: ScoreItemConfig[] = [
  {
    key: "problem",
    label: "問題把握",
    description: "職場の状況を幅広く捉え、重要な問題を的確に把握する",
    step: 0.5,
    max: 5,
    children: [
      { key: "problemUnderstanding", label: "状況理解", description: "職場の状況を幅広く認識している", step: 1, max: 4 },
      { key: "problemEssence", label: "本質把握", description: "問題の要点を把握し、簡潔に表現する", step: 1, max: 4 },
      { key: "problemMaintenanceBiz", label: "維持管理・業務", description: "職場の維持管理に関わる、業務面の問題を把握している", step: 1, max: 4 },
      { key: "problemMaintenanceHr", label: "維持管理・人", description: "職場の維持管理に関わる、対人面の問題を把握している", step: 1, max: 4 },
      { key: "problemReformBiz", label: "改革・業務", description: "職場の改革に関わる、業務面の問題を把握している", step: 1, max: 4 },
      { key: "problemReformHr", label: "改革・人", description: "職場の改革に関わる、対人面の問題を把握している", step: 1, max: 4 },
    ],
  },
  {
    key: "solution",
    label: "対策立案",
    description: "職場の重要な問題への具体的な対策を立案する",
    step: 0.5,
    max: 5,
    children: [
      { key: "solutionCoverage", label: "網羅性", description: "職場の問題に幅広く対応しようとしている", step: 1, max: 4 },
      { key: "solutionPlanning", label: "計画性", description: "実行可能な行動プランを立てる", step: 1, max: 4 },
      { key: "solutionMaintenanceBiz", label: "維持管理・業務", description: "職場の維持管理に関わる、業務面の問題に対策を立案している", step: 1, max: 4 },
      { key: "solutionMaintenanceHr", label: "維持管理・人", description: "職場の維持管理に関わる、対人面の問題に対策を立案している", step: 1, max: 4 },
      { key: "solutionReformBiz", label: "改革・業務", description: "職場の改革に関わる、業務面の問題に対策を立案している", step: 1, max: 4 },
      { key: "solutionReformHr", label: "改革・人", description: "職場の改革に関わる、対人面の問題に対策を立案している", step: 1, max: 4 },
    ],
  },
  {
    key: "leadership",
    label: "主導",
    description: "主体的に問題解決に取り組む",
    step: 0.5,
    max: 4,
  },
  {
    key: "collaboration",
    label: "連携",
    description: "関係者に働きかける",
    step: 0.5,
    max: 4,
    children: [
      { key: "collabSupervisor", label: "上司", description: "上司に適切なタイミングで報告・連絡・相談する", step: 1, max: 4 },
      { key: "collabExternal", label: "職場外", description: "職場外の関係者を適切に巻き込みながら、問題を解決する", step: 1, max: 4 },
      { key: "collabMember", label: "メンバー", description: "メンバーを巻き込みながら問題を解決する", step: 1, max: 4 },
    ],
  },
  {
    key: "development",
    label: "育成",
    description: "メンバーや部下を育成する",
    step: 0.5,
    max: 4,
  },
];

interface PredictClientProps {
  cases: Case[];
}

// 再帰的に折りたたみ可能なスコアセクション
function RecursiveScoreSection({
  item,
  scores,
  onChange,
  expandedSections,
  toggleSection,
  depth = 0,
}: {
  item: ScoreItemConfig;
  scores: Scores;
  onChange: (key: keyof Scores, value: number) => void;
  expandedSections: Set<string>;
  toggleSection: (key: string) => void;
  depth?: number;
}) {
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = expandedSections.has(item.key);

  // 深さに応じたスタイル
  const isRoot = depth === 0;
  const isChild = depth === 1;
  const isGrandChild = depth >= 2;

  const paddingLeft = depth * 16;
  const fontSize = isRoot ? "text-sm" : isChild ? "text-xs" : "text-[11px]";
  const descFontSize = isRoot ? "text-[11px]" : "text-[10px]";
  const bgColor = isRoot ? "var(--background)" : "var(--surface)";
  const inputBorder = isRoot ? "var(--primary)" : "var(--border)";

  return (
    <div
      className={`${isRoot ? "rounded-lg overflow-hidden" : ""}`}
      style={{ background: isRoot ? bgColor : "transparent" }}
    >
      {/* 項目行 */}
      <div
        className="flex items-center gap-2 py-2.5"
        style={{
          paddingLeft: isRoot ? 16 : paddingLeft,
          paddingRight: 16,
          borderBottom: (hasChildren && isExpanded) || !isRoot ? "1px solid var(--border)" : "none",
          background: isRoot ? bgColor : "transparent",
        }}
      >
        {/* 折りたたみボタン + ラベル部分（クリックで開閉） */}
        {hasChildren ? (
          <button
            onClick={() => toggleSection(item.key)}
            className="flex items-center gap-2 flex-1 min-w-0 text-left hover:opacity-70 transition-opacity"
          >
            <div
              className="w-5 h-5 rounded flex items-center justify-center flex-shrink-0"
              style={{ background: isRoot ? "var(--surface)" : "var(--background)" }}
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" style={{ color: "#323232" }} />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" style={{ color: "#323232" }} />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-bold ${fontSize}`} style={{ color: "#323232" }}>
                {item.label}
              </p>
              <p className={`${descFontSize} mt-0.5 leading-relaxed`} style={{ color: "var(--text-muted)" }}>
                {item.description}
              </p>
            </div>
          </button>
        ) : (
          <>
            <div className="w-5" />
            <div className="flex-1 min-w-0">
              <p className={`font-bold ${fontSize}`} style={{ color: "#323232" }}>
                {item.label}
              </p>
              <p className={`${descFontSize} mt-0.5 leading-relaxed`} style={{ color: "var(--text-muted)" }}>
                {item.description}
              </p>
            </div>
          </>
        )}

        {/* 数値入力 */}
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input
            type="number"
            min="1"
            max={item.max}
            step={item.step}
            value={scores[item.key] ?? 2}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              if (!isNaN(val) && val >= 1 && val <= item.max) {
                onChange(item.key, val);
              }
            }}
            className={`w-14 text-center py-1 rounded font-bold ${isGrandChild ? "text-xs" : "text-sm"}`}
            style={{
              border: `1px solid ${inputBorder}`,
              background: "#fff",
              color: "#323232",
            }}
          />
          <span className="text-[9px] w-8 text-right" style={{ color: "var(--text-muted)" }}>
            /{item.max}
          </span>
        </div>
      </div>

      {/* 子項目（再帰的に描画） */}
      {hasChildren && isExpanded && (
        <div style={{ background: "var(--surface)" }}>
          {item.children!.map((child) => (
            <RecursiveScoreSection
              key={child.key}
              item={child}
              scores={scores}
              onChange={onChange}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PredictClient({ cases }: PredictClientProps) {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [scores, setScores] = useState<Scores>(defaultScores);
  const [result, setResult] = useState<PredictionResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [openAccordions, setOpenAccordions] = useState<Set<string>>(new Set(["q1", "q2"]));
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isExporting, setIsExporting] = useState(false);

  const toggleAccordion = useCallback((key: string) => {
    setOpenAccordions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleSection = useCallback((key: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const selectedCase = useMemo(
    () => cases.find((c) => c.case_id === selectedCaseId),
    [cases, selectedCaseId]
  );

  // 役割理解は主導・連携・育成の平均として自動計算
  const calculatedRole = useMemo(() => {
    const avg = (scores.leadership + scores.collaboration + scores.development) / 3;
    return Math.round(avg * 10) / 10; // 小数点1桁に丸め
  }, [scores.leadership, scores.collaboration, scores.development]);

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
      // 役割理解を自動計算してスコアに追加
      const scoresWithRole = { ...scores, role: calculatedRole };
      const response = await predictAnswer(selectedCaseId, scoresWithRole);
      if (response.success) {
        setResult(response.data);
      } else {
        setError(response.error);
        setResult(null);
      }
    });
  };

  const handleExportPdf = async () => {
    if (!result) return;

    setIsExporting(true);
    try {
      const caseName = selectedCase?.case_name || selectedCaseId;
      const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");

      // スコアデータを整形
      const scoreData = scoreStructure.map((item) => ({
        label: item.label,
        value: scores[item.key] ?? 0,
        max: item.max,
      }));

      await exportAnswerPredictToPdf(
        {
          caseName,
          situationText: selectedCase?.situation_text ?? undefined,
          scores: scoreData,
          roleScore: calculatedRole,
          q1Answer: result.q1Answer,
          q2Answer: result.q2Answer,
          q1Reason: result.q1Reason,
          q2Reason: result.q2Reason,
        },
        `回答予測_${caseName}_${timestamp}`
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
      {/* ケース選択 */}
      <div className="p-5">
        <div className="flex items-center gap-3 mb-3 max-w-md">
          <FolderOpen className="w-5 h-5 flex-shrink-0" style={{ color: "#323232" }} />
          <label className="text-sm font-black" style={{ color: "#323232" }}>
            ケース
          </label>
        </div>
        <select
          value={selectedCaseId}
          onChange={(e) => {
            setSelectedCaseId(e.target.value);
            setResult(null);
          }}
          className="max-w-md px-4 py-2.5 rounded-lg text-sm font-bold appearance-none cursor-pointer"
          style={{
            border: "1px solid var(--border)",
            background: `var(--background) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23323232' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 14px center`,
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

      {/* 目標スコア設定 - 縦並び階層構造 */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center justify-between mb-4">
          <label className="text-sm font-black" style={{ color: "#323232" }}>
            目標スコア設定
          </label>
          <button
            onClick={() => {
              // 全展開/全折りたたみ（3階層すべて対応）
              const collectAllExpandableKeys = (items: ScoreItemConfig[]): string[] => {
                const keys: string[] = [];
                for (const item of items) {
                  if (item.children && item.children.length > 0) {
                    keys.push(item.key);
                    keys.push(...collectAllExpandableKeys(item.children));
                  }
                }
                return keys;
              };
              const allKeys = collectAllExpandableKeys(scoreStructure);
              if (expandedSections.size >= allKeys.length) {
                setExpandedSections(new Set());
              } else {
                setExpandedSections(new Set(allKeys));
              }
            }}
            className="text-[11px] px-2 py-1 rounded hover:opacity-70 transition-opacity"
            style={{ color: "var(--primary)", background: "var(--background)" }}
          >
            {expandedSections.size > 0 ? "すべて折りたたむ" : "すべて展開"}
          </button>
        </div>

        <div className="space-y-2">
          {scoreStructure.map((item) => (
            <RecursiveScoreSection
              key={item.key}
              item={item}
              scores={scores}
              onChange={handleScoreChange}
              expandedSections={expandedSections}
              toggleSection={toggleSection}
              depth={0}
            />
          ))}
        </div>

        <p className="text-[10px] mt-4 text-center" style={{ color: "var(--text-muted)" }}>
          各スコアの上限値・刻み幅は項目ごとに異なります。詳細項目は親項目の左の矢印をクリックして展開できます。
        </p>

        {/* 役割理解（自動計算表示） */}
        <div
          className="mt-4 p-4 rounded-lg"
          style={{ background: "var(--background)", border: "1px solid var(--primary)" }}
        >
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold" style={{ color: "#323232" }}>
                役割理解（自動計算）
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                ＝（主導 + 連携 + 育成）÷ 3
              </p>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="text-lg font-black px-3 py-1 rounded"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                {calculatedRole.toFixed(1)}
              </span>
              <span className="text-[9px]" style={{ color: "var(--text-muted)" }}>
                /5
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 実行ボタン */}
      <div className="flex justify-end">
        <button
          onClick={handlePredict}
          disabled={!selectedCaseId || isPending}
          className="px-6 py-2.5 text-sm font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
          style={{
            background: "linear-gradient(135deg, #6366f1 0%, #4338ca 100%)",
            borderRadius: "5px"
          }}
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
          {/* PDF出力リンク */}
          <div className="flex justify-end px-2">
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
          {/* 設問1 */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: openAccordions.has("q1") ? "1px solid var(--primary)" : "1px solid var(--border)",
              transition: "border-color 0.2s ease",
            }}
          >
            <button
              onClick={() => toggleAccordion("q1")}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: openAccordions.has("q1") ? "var(--primary)" : "var(--background)" }}
              >
                <Target
                  className="w-4 h-4"
                  style={{ color: openAccordions.has("q1") ? "#fff" : "var(--text-muted)" }}
                />
              </div>
              <span className="text-sm font-black flex-1" style={{ color: "#323232" }}>
                設問1
              </span>
              <ChevronRight
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: "var(--text-muted)",
                  transform: openAccordions.has("q1") ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{
                maxHeight: openAccordions.has("q1") ? "1000px" : "0",
                opacity: openAccordions.has("q1") ? 1 : 0,
              }}
            >
              <div
                className="px-4 pb-4 pt-0"
                style={{ marginLeft: "44px" }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                  {result.q1Answer}
                </p>
              </div>
            </div>
          </div>

          {/* 設問2 */}
          <div
            className="rounded-xl overflow-hidden"
            style={{
              background: "var(--surface)",
              border: openAccordions.has("q2") ? "1px solid var(--primary)" : "1px solid var(--border)",
              transition: "border-color 0.2s ease",
            }}
          >
            <button
              onClick={() => toggleAccordion("q2")}
              className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: openAccordions.has("q2") ? "var(--primary)" : "var(--background)" }}
              >
                <MessageSquare
                  className="w-4 h-4"
                  style={{ color: openAccordions.has("q2") ? "#fff" : "var(--text-muted)" }}
                />
              </div>
              <span className="text-sm font-black flex-1" style={{ color: "#323232" }}>
                設問2
              </span>
              <ChevronRight
                className="w-4 h-4 transition-transform duration-200"
                style={{
                  color: "var(--text-muted)",
                  transform: openAccordions.has("q2") ? "rotate(90deg)" : "rotate(0deg)",
                }}
              />
            </button>
            <div
              className="overflow-hidden transition-all duration-200"
              style={{
                maxHeight: openAccordions.has("q2") ? "1000px" : "0",
                opacity: openAccordions.has("q2") ? 1 : 0,
              }}
            >
              <div
                className="px-4 pb-4 pt-0"
                style={{ marginLeft: "44px" }}
              >
                <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                  {result.q2Answer}
                </p>
              </div>
            </div>
          </div>

          {/* 理由 */}
          {(result.q1Reason || result.q2Reason) && (
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
                  {result.q1Reason && (
                    <div>
                      <p className="text-xs font-bold mb-1.5" style={{ color: "var(--primary)" }}>
                        設問1について
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                        {result.q1Reason}
                      </p>
                    </div>
                  )}
                  {result.q2Reason && (
                    <div>
                      <p className="text-xs font-bold mb-1.5" style={{ color: "var(--primary)" }}>
                        設問2について
                      </p>
                      <p className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "#323232" }}>
                        {result.q2Reason}
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
