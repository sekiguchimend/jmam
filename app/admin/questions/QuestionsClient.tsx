"use client";

import { useState, useTransition, useEffect } from "react";
import { fetchQuestions, saveQuestion, removeQuestion, saveCaseSituation } from "@/actions/questions";
import type { Case, Question } from "@/types";
import {
  AlertCircle,
  CheckCircle,
  FileQuestion,
  FileText,
  FolderOpen,
  Loader2,
  Save,
  Trash2,
} from "lucide-react";

interface QuestionsClientProps {
  cases: Case[];
}

export function QuestionsClient({ cases }: QuestionsClientProps) {
  const [selectedCaseId, setSelectedCaseId] = useState("");
  const [situationText, setSituationText] = useState("");
  const [q1Text, setQ1Text] = useState("");
  const [q2Text, setQ2Text] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isLoading, setIsLoading] = useState(false);

  // ケース選択時に既存の設問とケース内容を取得
  useEffect(() => {
    if (!selectedCaseId) {
      setSituationText("");
      setQ1Text("");
      setQ2Text("");
      return;
    }

    setIsLoading(true);
    setError(null);
    setSuccess(null);

    // ケース内容を設定
    const selectedCase = cases.find((c) => c.case_id === selectedCaseId);
    setSituationText(selectedCase?.situation_text || "");

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
  }, [selectedCaseId, cases]);

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

  // ケース内容（シチュエーション）を保存
  const handleSaveSituation = async () => {
    if (!selectedCaseId) {
      setError("ケースを選択してください");
      return;
    }

    if (!situationText.trim()) {
      setError("ケース内容を入力してください");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await saveCaseSituation({
        caseId: selectedCaseId,
        situationText: situationText.trim(),
      });

      if (result.success) {
        setSuccess("ケース内容を保存しました（Embeddingも生成されました）");
        setTimeout(() => setSuccess(null), 3000);
      } else {
        setError(result.error || "保存に失敗しました");
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
        <div className="flex items-center gap-3 mb-2 max-w-md">
          <FolderOpen className="w-5 h-5 flex-shrink-0" style={{ color: "#323232" }} />
          <label className="text-sm font-black" style={{ color: "#323232" }}>
            ケース
          </label>
        </div>
        <select
          value={selectedCaseId}
          onChange={(e) => setSelectedCaseId(e.target.value)}
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

      {/* ケース内容・設問入力フォーム */}
      {selectedCaseId && !isLoading && (
        <>
          {/* ケース内容（シチュエーション） */}
          <div
            className="rounded-xl p-5"
            style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
          >
            <div className="flex items-center gap-3 mb-3">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#6366f1" }}
              >
                <FileText className="w-4 h-4 text-white" />
              </div>
              <label className="text-sm font-black" style={{ color: "#323232" }}>
                ケース内容（シチュエーション）
              </label>
            </div>
            <textarea
              value={situationText}
              onChange={(e) => setSituationText(e.target.value)}
              placeholder="ケースのシチュエーション（状況説明）を入力してください...&#10;例：あなたは〇〇部門の課長です。部下に△△という問題が発生しています..."
              rows={8}
              className="w-full px-4 py-3 rounded-lg text-sm font-bold resize-none"
              style={{
                border: "1px solid var(--border)",
                background: "var(--background)",
                color: "#323232",
              }}
            />
            <div className="flex justify-between items-center mt-3">
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                {situationText.length} 文字
              </p>
              <button
                onClick={handleSaveSituation}
                disabled={!situationText.trim() || isPending}
                className="px-4 py-2 rounded-lg text-xs font-black transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 text-white flex items-center gap-2"
                style={{ background: "#6366f1" }}
              >
                {isPending ? (
                  <>
                    <Loader2 className="w-3 h-3 animate-spin" />
                    保存中...
                  </>
                ) : (
                  <>
                    <Save className="w-3 h-3" />
                    保存（Embedding生成）
                  </>
                )}
              </button>
            </div>
            <p className="text-xs mt-2" style={{ color: "var(--text-muted)" }}>
              ※ 保存時にケース内容のEmbeddingが自動生成され、類似ケース検索に活用されます
            </p>
          </div>

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
        style={{ background: "#f5f5f5" }}
      >
        <h3 className="text-sm font-black mb-2" style={{ color: "#323232" }}>
          ケース・設問管理について
        </h3>
        <ul className="text-sm space-y-2" style={{ color: "var(--text-muted)" }}>
          <li>• <strong>ケース内容</strong>: 診断者が読むシチュエーション（状況説明文）</li>
          <li>• <strong>設問1（q1）</strong>: answer_q1 に対応する質問文（箇条書き形式）</li>
          <li>• <strong>設問2（q2）</strong>: answer_q2〜q8 を結合した回答に対応する質問文（文章形式）</li>
          <li>• 保存時にテキストのEmbeddingが自動生成されます</li>
          <li>• ケースのEmbeddingは未知のケースに対するスコア予測時に、類似ケースの検索に活用されます</li>
        </ul>
      </div>
    </div>
  );
}
