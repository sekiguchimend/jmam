"use client";

import { useState, useTransition, useEffect } from "react";
import { fetchQuestions, saveQuestion, saveCaseSituation } from "@/actions/questions";
import type { Case } from "@/types";
import {
  GradientButton,
  FormTextarea,
  FormSelect,
  ErrorMessage,
  SuccessMessage,
  PageLoading,
} from "@/components/ui";
import {
  FileQuestion,
  FileText,
  FolderOpen,
  Save,
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

    fetchQuestions(selectedCaseId).then((result) => {
      setIsLoading(false);
      if (result.success) {
        // ケース内容を設定（DBから最新を取得）
        setSituationText(result.situationText || "");
        // 設問を設定
        const q1 = result.questions?.find((q) => q.question_key === "q1");
        const q2 = result.questions?.find((q) => q.question_key === "q2");
        setQ1Text(q1?.question_text || "");
        setQ2Text(q2?.question_text || "");
      } else {
        setSituationText("");
        setQ1Text("");
        setQ2Text("");
        if (result.error) {
          setError(result.error);
        }
      }
    });
  }, [selectedCaseId]);

  // 一括保存
  const handleSaveAll = async () => {
    if (!selectedCaseId) {
      setError("ケースを選択してください");
      return;
    }

    // 少なくとも1つは入力されているか確認
    if (!situationText.trim() && !q1Text.trim() && !q2Text.trim()) {
      setError("保存するデータがありません");
      return;
    }

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const results: string[] = [];
      const errors: string[] = [];

      // ケース内容を保存
      if (situationText.trim()) {
        const result = await saveCaseSituation({
          caseId: selectedCaseId,
          situationText: situationText.trim(),
        });
        if (result.success) {
          results.push("ケース内容");
        } else {
          errors.push(result.error || "ケース内容の保存に失敗");
        }
      }

      // 設問1を保存
      if (q1Text.trim()) {
        const result = await saveQuestion({
          caseId: selectedCaseId,
          questionKey: "q1",
          questionText: q1Text.trim(),
        });
        if (result.success) {
          results.push("設問1");
        } else {
          errors.push(result.error || "設問1の保存に失敗");
        }
      }

      // 設問2を保存
      if (q2Text.trim()) {
        const result = await saveQuestion({
          caseId: selectedCaseId,
          questionKey: "q2",
          questionText: q2Text.trim(),
        });
        if (result.success) {
          results.push("設問2");
        } else {
          errors.push(result.error || "設問2の保存に失敗");
        }
      }

      if (errors.length > 0) {
        setError(errors.join("、"));
      }

      if (results.length > 0) {
        setSuccess(`${results.join("、")}を保存しました`);
        setTimeout(() => setSuccess(null), 3000);
      }
    });
  };

  const caseOptions = cases.map((c) => ({
    value: c.case_id,
    label: c.case_name || c.case_id,
  }));

  return (
    <div className="space-y-3">
      {/* ケース選択 + 一括保存ボタン */}
      <div
        className="p-5"
        style={{ background: "transparent" }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <FormSelect
              label="ケース"
              icon={<FolderOpen className="w-5 h-5 flex-shrink-0" style={{ color: "#323232" }} />}
              options={caseOptions}
              value={selectedCaseId}
              onChange={(e) => setSelectedCaseId(e.target.value)}
              className="w-full"
            />
          </div>

          {/* 一括保存ボタン */}
          {selectedCaseId && !isLoading && (
            <GradientButton
              onClick={handleSaveAll}
              disabled={isPending || (!situationText.trim() && !q1Text.trim() && !q2Text.trim())}
              isLoading={isPending}
              loadingText="保存中..."
              icon={<Save className="w-4 h-4" />}
              className="whitespace-nowrap"
            >
              すべて保存
            </GradientButton>
          )}
        </div>
      </div>

      {/* ローディング */}
      {isLoading && <PageLoading text="設問を読み込み中..." />}

      {/* ケース内容・設問入力フォーム */}
      {selectedCaseId && !isLoading && (
        <>
          {/* ケース内容（シチュエーション） */}
          <div className="p-5">
            <FormTextarea
              label="ケース内容（シチュエーション）"
              icon={<FileText className="w-5 h-5" style={{ color: "#323232" }} />}
              value={situationText}
              onChange={(e) => setSituationText(e.target.value)}
              placeholder="ケースのシチュエーション（状況説明）を入力してください...&#10;例：あなたは〇〇部門の課長です。部下に△△という問題が発生しています..."
              rows={8}
              charCount={situationText.length}
            />
          </div>

          {/* 設問1 */}
          <div className="p-5">
            <FormTextarea
              label="設問1（q1）- 箇条書き形式"
              icon={<FileQuestion className="w-5 h-5" style={{ color: "#323232" }} />}
              value={q1Text}
              onChange={(e) => setQ1Text(e.target.value)}
              placeholder="設問1の質問文を入力してください..."
              rows={4}
              charCount={q1Text.length}
            />
          </div>

          {/* 設問2 */}
          <div className="p-5">
            <FormTextarea
              label="設問2（q2）- 文章形式（answer_q2〜q8を結合）"
              icon={<FileQuestion className="w-5 h-5" style={{ color: "#323232" }} />}
              value={q2Text}
              onChange={(e) => setQ2Text(e.target.value)}
              placeholder="設問2の質問文を入力してください..."
              rows={4}
              charCount={q2Text.length}
            />
          </div>
        </>
      )}

      {/* エラー */}
      {error && <ErrorMessage message={error} />}

      {/* 成功 */}
      {success && <SuccessMessage message={success} />}

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
