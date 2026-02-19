"use client";

import { useState, useCallback, useTransition, useRef, memo, useMemo } from "react";
import {
  adminFetchPredictionHistory,
  type PredictionHistoryRecord,
  type PredictionType,
} from "@/actions/predictionHistory";
import {
  Calculator,
  FileText,
  Inbox,
  Loader2,
  ChevronRight,
  Target,
  MessageSquare,
  User,
} from "lucide-react";

interface AdminHistoryClientProps {
  initialRecords: PredictionHistoryRecord[];
  initialTotal: number;
}

type FilterType = "all" | "score_all" | "score_existing" | "score_new" | "answer";

const filterLabels: Record<FilterType, string> = {
  all: "すべて",
  score_all: "スコア予測",
  score_existing: "スコア予測（既存）",
  score_new: "スコア予測（新規）",
  answer: "解答予測",
};

const typeLabels: Record<PredictionType, string> = {
  score_existing: "スコア予測（既存）",
  score_new: "スコア予測（新規）",
  answer: "解答予測",
};

const typeColors: Record<PredictionType, { bg: string; text: string }> = {
  score_existing: { bg: "#e0e7ff", text: "#4338ca" },
  score_new: { bg: "#dbeafe", text: "#1d4ed8" },
  answer: { bg: "#dcfce7", text: "#15803d" },
};

// フィルター結果のキャッシュ型
interface FilterCache {
  records: PredictionHistoryRecord[];
  total: number;
}

export function AdminHistoryClient({ initialRecords, initialTotal }: AdminHistoryClientProps) {
  const [records, setRecords] = useState<PredictionHistoryRecord[]>(initialRecords);
  const [total, setTotal] = useState(initialTotal);
  const [filter, setFilter] = useState<FilterType>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // フィルター結果をキャッシュ（初期値として"all"のデータをキャッシュ）
  const filterCache = useRef<Map<FilterType, FilterCache>>(
    new Map([["all", { records: initialRecords, total: initialTotal }]])
  );

  const handleFilterChange = useCallback(
    (newFilter: FilterType) => {
      // 同じフィルターなら何もしない
      if (newFilter === filter) return;

      setFilter(newFilter);

      // キャッシュにある場合はそれを使用
      const cached = filterCache.current.get(newFilter);
      if (cached) {
        setRecords(cached.records);
        setTotal(cached.total);
        return;
      }

      startTransition(async () => {
        const type =
          newFilter === "all"
            ? undefined
            : newFilter === "score_all"
            ? "score_all"
            : (newFilter as PredictionType);

        const result = await adminFetchPredictionHistory({
          type: type as PredictionType | "score_all" | undefined,
          limit: 50,
        });

        if (result.success) {
          const newRecords = result.records ?? [];
          const newTotal = result.total ?? 0;
          setRecords(newRecords);
          setTotal(newTotal);
          // キャッシュに保存
          filterCache.current.set(newFilter, { records: newRecords, total: newTotal });
        }
      });
    },
    [filter]
  );

  const toggleExpand = useCallback((id: string) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="space-y-4">
      {/* フィルター - 常に表示 */}
      <div
        className="flex flex-wrap items-center gap-2 py-3"
        style={{
          marginLeft: "calc(-50vw + 50%)",
          marginRight: "calc(-50vw + 50%)",
          paddingLeft: "calc(50vw - 50% + 1rem)",
          paddingRight: "calc(50vw - 50% + 1rem)",
          borderBottom: "1px solid rgba(0, 0, 0, 0.08)",
          boxShadow: "0 2px 4px 0 rgba(0, 0, 0, 0.06)",
          clipPath: "inset(0 0 -10px 0)",
        }}
      >
        {(Object.keys(filterLabels) as FilterType[]).map((key) => (
          <button
            key={key}
            onClick={() => handleFilterChange(key)}
            disabled={isPending}
            className="px-4 py-2 text-xs font-black transition-all disabled:opacity-50"
            style={{
              background: filter === key ? "var(--primary)" : "transparent",
              color: filter === key ? "#fff" : "#555",
              borderRadius: "8px",
            }}
          >
            {filterLabels[key]}
          </button>
        ))}
        {isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" style={{ color: "var(--primary)" }} />}
      </div>

      {/* 件数表示 - 常に表示 */}
      <div className="flex items-center justify-between px-2">
        <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>
          {total} 件の履歴
        </p>
      </div>

      {/* 履歴一覧またはデータなしメッセージ */}
      {isPending ? (
        <div
          className="rounded-xl p-8 lg:p-12 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Loader2 className="w-8 h-8 animate-spin mx-auto" style={{ color: "var(--primary)" }} />
          <p className="text-sm font-bold mt-4" style={{ color: "var(--text-muted)" }}>
            読み込み中...
          </p>
        </div>
      ) : records.length === 0 ? (
        <div
          className="rounded-xl p-8 lg:p-12 text-center"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <Inbox className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4" style={{ color: "var(--text-muted)" }} />
          <h3 className="text-base lg:text-lg font-black mb-2" style={{ color: "#323232" }}>
            {filter === "all" ? "履歴がありません" : `${filterLabels[filter]}の履歴がありません`}
          </h3>
          <p className="text-sm lg:text-base font-bold" style={{ color: "#323232" }}>
            {filter === "all"
              ? "ユーザーが予測を実行すると、ここに履歴が表示されます"
              : "他のフィルターを試してください"}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((record) => (
            <HistoryItem
              key={record.id}
              record={record}
              isExpanded={expandedId === record.id}
              onToggle={() => toggleExpand(record.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// formatDateをメモ化（コンポーネント外に移動）
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

// 履歴アイテムコンポーネント（memo化でパフォーマンス改善）
const HistoryItem = memo(function HistoryItem({
  record,
  isExpanded,
  onToggle,
}: {
  record: PredictionHistoryRecord;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const typeColor = typeColors[record.prediction_type];

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{
        background: "var(--surface)",
        border: isExpanded ? "1px solid var(--primary)" : "1px solid var(--border)",
        transition: "border-color 0.2s ease",
      }}
    >
      {/* ヘッダー（クリックで展開） */}
      <button
        onClick={onToggle}
        className="w-full px-4 py-3.5 flex items-center gap-3 text-left hover:opacity-80 transition-opacity"
      >
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: isExpanded ? "var(--primary)" : "var(--background)" }}
        >
          {record.prediction_type === "answer" ? (
            <MessageSquare
              className="w-5 h-5"
              style={{ color: isExpanded ? "#fff" : "var(--text-muted)" }}
            />
          ) : (
            <Calculator
              className="w-5 h-5"
              style={{ color: isExpanded ? "#fff" : "var(--text-muted)" }}
            />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span
              className="px-2 py-0.5 rounded text-[10px] font-black"
              style={{ background: typeColor.bg, color: typeColor.text }}
            >
              {typeLabels[record.prediction_type]}
            </span>
            {/* ユーザー情報 */}
            <span
              className="px-2 py-0.5 rounded text-[10px] font-black flex items-center gap-1"
              style={{ background: "#f3f4f6", color: "#6b7280" }}
            >
              <User className="w-3 h-3" />
              {record.user_name || record.user_email || "不明なユーザー"}
            </span>
            <span className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
              {formatDate(record.created_at)}
            </span>
          </div>
          <p className="text-sm font-black truncate" style={{ color: "#323232" }}>
            {record.case_name || record.case_id || "新規ケース"}
          </p>
        </div>

        <ChevronRight
          className="w-4 h-4 flex-shrink-0 transition-transform duration-200"
          style={{
            color: "var(--text-muted)",
            transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
          }}
        />
      </button>

      {/* 詳細（展開時） */}
      <div
        className="overflow-hidden transition-all duration-200"
        style={{
          maxHeight: isExpanded ? "2000px" : "0",
          opacity: isExpanded ? 1 : 0,
        }}
      >
        <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="pt-4 space-y-4">
            {/* ユーザー詳細情報 */}
            <div
              className="p-3 rounded-lg flex items-center gap-3"
              style={{ background: "var(--background)" }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--primary)" }}
              >
                <User className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-sm font-black" style={{ color: "#323232" }}>
                  {record.user_name || "名前未設定"}
                </p>
                <p className="text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  {record.user_email || "メールアドレス不明"}
                </p>
              </div>
            </div>

            {/* ケース情報 */}
            {record.prediction_type === "score_new" && record.situation_text && (
              <div>
                <p className="text-xs font-black mb-1" style={{ color: "var(--primary)" }}>
                  シチュエーション
                </p>
                <p
                  className="text-sm leading-relaxed p-3 rounded-lg"
                  style={{ background: "var(--background)", color: "#323232" }}
                >
                  {record.situation_text.length > 200
                    ? `${record.situation_text.substring(0, 200)}...`
                    : record.situation_text}
                </p>
              </div>
            )}

            {/* スコア予測の場合: 入力解答と結果スコア */}
            {(record.prediction_type === "score_existing" || record.prediction_type === "score_new") && (
              <>
                {/* 入力解答 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {record.input_q1_answer && (
                    <div>
                      <p className="text-xs font-black mb-1 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                        <Target className="w-3 h-3" />
                        設問1の解答
                      </p>
                      <p
                        className="text-sm leading-relaxed p-3 rounded-lg"
                        style={{ background: "var(--background)", color: "#323232" }}
                      >
                        {record.input_q1_answer.length > 100
                          ? `${record.input_q1_answer.substring(0, 100)}...`
                          : record.input_q1_answer}
                      </p>
                    </div>
                  )}
                  {record.input_q2_answer && (
                    <div>
                      <p className="text-xs font-black mb-1 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                        <FileText className="w-3 h-3" />
                        設問2の解答
                      </p>
                      <p
                        className="text-sm leading-relaxed p-3 rounded-lg"
                        style={{ background: "var(--background)", color: "#323232" }}
                      >
                        {record.input_q2_answer.length > 100
                          ? `${record.input_q2_answer.substring(0, 100)}...`
                          : record.input_q2_answer}
                      </p>
                    </div>
                  )}
                </div>

                {/* 結果スコア */}
                {record.result_scores && (
                  <div>
                    <p className="text-xs font-black mb-2 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                      <Calculator className="w-3 h-3" />
                      予測スコア
                      {record.confidence != null && (
                        <span className="ml-2 text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                          (信頼度: {(record.confidence * 100).toFixed(0)}%)
                        </span>
                      )}
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Object.entries(record.result_scores)
                        .filter(([key, value]) => value != null && ["problem", "solution", "role", "leadership", "collaboration", "development"].includes(key))
                        .map(([key, value]) => (
                          <ScoreBadge
                            key={key}
                            label={scoreLabels[key] ?? key}
                            value={value as number}
                          />
                        ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* 解答予測の場合: 入力スコアと結果解答 */}
            {record.prediction_type === "answer" && (
              <>
                {/* 入力スコア */}
                {record.input_scores && (
                  <div>
                    <p className="text-xs font-black mb-2 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                      <Calculator className="w-3 h-3" />
                      入力スコア
                    </p>
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {Object.entries(record.input_scores)
                        .filter(([key, value]) => value != null && ["problem", "solution", "role", "leadership", "collaboration", "development"].includes(key))
                        .map(([key, value]) => (
                          <ScoreBadge
                            key={key}
                            label={scoreLabels[key] ?? key}
                            value={value as number}
                          />
                        ))}
                    </div>
                  </div>
                )}

                {/* 結果解答 */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {record.result_predicted_q1 && (
                    <div>
                      <p className="text-xs font-black mb-1 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                        <Target className="w-3 h-3" />
                        予測した設問1の解答
                      </p>
                      <p
                        className="text-sm leading-relaxed p-3 rounded-lg"
                        style={{ background: "var(--background)", color: "#323232" }}
                      >
                        {record.result_predicted_q1.length > 200
                          ? `${record.result_predicted_q1.substring(0, 200)}...`
                          : record.result_predicted_q1}
                      </p>
                    </div>
                  )}
                  {record.result_predicted_q2 && (
                    <div>
                      <p className="text-xs font-black mb-1 flex items-center gap-1" style={{ color: "var(--primary)" }}>
                        <FileText className="w-3 h-3" />
                        予測した設問2の解答
                      </p>
                      <p
                        className="text-sm leading-relaxed p-3 rounded-lg"
                        style={{ background: "var(--background)", color: "#323232" }}
                      >
                        {record.result_predicted_q2.length > 200
                          ? `${record.result_predicted_q2.substring(0, 200)}...`
                          : record.result_predicted_q2}
                      </p>
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
});

// スコアバッジコンポーネント（memo化でパフォーマンス改善）
const ScoreBadge = memo(function ScoreBadge({ label, value }: { label: string; value: number }) {
  return (
    <div
      className="text-center p-2 rounded-lg"
      style={{ background: "var(--background)" }}
    >
      <p className="text-[10px] font-bold mb-0.5" style={{ color: "var(--text-muted)" }}>
        {label}
      </p>
      <p className="text-sm font-black" style={{ color: "var(--primary)" }}>
        {typeof value === "number" ? value.toFixed(1) : value}
      </p>
    </div>
  );
});

// スコアラベル
const scoreLabels: Record<string, string> = {
  problem: "問題把握",
  solution: "対策立案",
  role: "役割理解",
  leadership: "主導",
  collaboration: "連携",
  development: "育成",
};
