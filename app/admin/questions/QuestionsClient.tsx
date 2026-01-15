"use client";

import { useState, useTransition, useEffect } from "react";
import { fetchQuestions, saveQuestion, removeQuestion } from "@/actions/questions";
import type { Case, Question } from "@/types";
import {
  AlertCircle,
  CheckCircle,
  FileQuestion,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";

interface QuestionsClientProps {
  cases: Case[];
}

export function QuestionsClient({ cases }: QuestionsClientProps) {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [q1Text, setQ1Text] = useState("");
  const [q2Text, setQ2Text] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  // ケース選択時に既存の設問を取得
  useEffect(() => {
    if (!selectedCaseId) {
      setQ1Text("");
      setQ2Text("");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    fetchQuestions(selectedCaseId).then((result) => {
      setIsLoading(false);
      if (result.success && result.questions) {
        const q1 = result.questions.find((q) => q.question_key === "q1");
        const q2 = result.questions.find((q) => q.question_key === "q2");
        setQ1Text(q1?.question_text || "");
        setQ2Text(q2?.question_text || "");
      } else {
        setQ1Text("");
        setQ2Text("");
        if (result.error) {
          setError(result.error);
        }
      }
    });
  }, [selectedCaseId]);

  const handleSave = async (questionKey: "q1" | "q2") => {
    if (!selectedCaseId) {
      setError("ケースを選択してください");
      return;
    }

    const text = questionKey === "q1" ? q1Text : q2Text;
    if (!text.trim()) {
      setError(`設問${questionKey === "q1" ? "1" : "2"}のテキストを入力してください`);
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await saveQuestion({
        caseId: selectedCaseId,
        questionKey,
        questionText: text.trim(),
      });

      if (result.success) {
        setSuccess(`設問${questionKey === "q1" ? "1" : "2"}を保存しました`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "保存に失敗しました");
      }
    });
  };

  const handleDelete = async (questionKey: "q1" | "q2") => {
    if (!selectedCaseId) {
      setError("ケースを選択してください");
      return;
    }

    const text = questionKey === "q1" ? q1Text : q2Text;
    if (!text.trim()) {
      setError("削除する設問がありません");
      return;
    }

    if (!confirm(`設問${questionKey === "q1" ? "1" : "2"}を削除しますか？`)) {
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await removeQuestion({
        caseId: selectedCaseId,
        questionKey,
      });

      if (result.success) {
        if (questionKey === "q1") {
          setQ1Text("");
        } else {
          setQ2Text("");
        }
        setSuccess(`設問${questionKey === "q1" ? "1" : "2"}を削除しました`);
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "削除に失敗しました");
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
          onChange={(e) => setSelectedCaseId(e.target.value)}
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

      {/* ローディング */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: "var(--primary)" }} />
          <span className="ml-2 text-sm font-bold" style={{ color: "var(--text-muted)" }}>
            設問を読み込み中...
          </span>
        </div>
      )}

      {/* 設問入力フォーム */}
      {selectedCaseId && !isLoading && (
        <>
          {/* 設問1 */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--primary)" }}
              >
                <FileQuestion className="w-4 h-4 text-white" />
              </div>
              <label className="text-sm font-black" style={{ color: "#323232" }}>
                設問1（q1）- 箇条書き形式
              </label>
            </div>
            <textarea
              value={q1Text}
              onChange={(e) => setQ1Text(e.target.value)}
              placeholder="設問1の質問文を入力してください..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg text-sm font-bold resize-none"
              style={{
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "#323232",
              }}
            />
            <div className="flex justify-between items-center mt-3">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {q1Text.length} 文字
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete("q1")}
                  disabled={!q1Text.trim() || isPending}
                  className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
                  style={{ background: "var(--error-light)", color: "var(--error)" }}
                >
                  <Trash2 className="w-3 h-3" />
                  削除
                </button>
                <button
                  onClick={() => handleSave("q1")}
                  disabled={!q1Text.trim() || isPending}
                  className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
                  style={{ background: "var(--primary)" }}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      保存
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 設問2 */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "var(--primary)" }}
              >
                <FileQuestion className="w-4 h-4 text-white" />
              </div>
              <label className="text-sm font-black" style={{ color: "#323232" }}>
                設問2（q2）- 文章形式（answer_q2〜q8を結合）
              </label>
            </div>
            <textarea
              value={q2Text}
              onChange={(e) => setQ2Text(e.target.value)}
              placeholder="設問2の質問文を入力してください..."
              rows={4}
              className="w-full px-4 py-3 rounded-lg text-sm font-bold resize-none"
              style={{
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "#323232",
              }}
            />
            <div className="flex justify-between items-center mt-3">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {q2Text.length} 文字
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDelete("q2")}
                  disabled={!q2Text.trim() || isPending}
                  className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 flex items-center gap-2"
                  style={{ background: "var(--error-light)", color: "var(--error)" }}
                >
                  <Trash2 className="w-3 h-3" />
                  削除
                </button>
                <button
                  onClick={() => handleSave("q2")}
                  disabled={!q2Text.trim() || isPending}
                  className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
                  style={{ background: "var(--primary)" }}
                >
                  {isPending ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin" />
                      保存中...
                    </>
                  ) : (
                    <>
                      <Save className="w-3 h-3" />
                      保存
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </>
      )}

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

      {/* 成功 */}
      {success && (
        <div
          className="p-4 rounded-xl flex items-center gap-3"
          style={{ background: "#dcfce7", color: "#16a34a" }}
        >
          <CheckCircle className="w-5 h-5 flex-shrink-0" />
          <span className="font-bold text-sm">{success}</span>
        </div>
      )}

      {/* 説明 */}
      <div
        className="rounded-xl p-5"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        <h3 className="text-sm font-black mb-2" style={{ color: "#323232" }}>
          設問管理について
        </h3>
        <ul className="text-sm space-y-2" style={{ color: "var(--text-muted)" }}>
          <li>• 設問1（q1）: answer_q1 に対応する質問文（箇条書き形式）</li>
          <li>• 設問2（q2）: answer_q2〜q8 を結合した回答に対応する質問文（文章形式）</li>
          <li>• 保存時に設問テキストのEmbeddingも自動生成されます</li>
          <li>• 設問Embeddingは類似回答検索の精度向上に活用されます</li>
        </ul>
      </div>
    </div>
  );
}
