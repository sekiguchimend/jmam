// CSVアップロードフォーム（Client Component）
// FR-07〜FR-11: アップロード、検証、バッチ処理、進捗表示、エラー報告
// Storage不要・直接処理版

"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { CloudUpload, Loader2, Check, X } from "lucide-react";
import { processCsvUpload, type UploadResult } from "@/actions/upload";

type UploadState = "idle" | "uploading" | "completed" | "error";

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-[#323232] animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#323232] animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#323232] animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

export function UploadClientForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [result, setResult] = useState<UploadResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile?.name.endsWith(".csv")) {
      setFile(droppedFile);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = () => {
    if (!file) return;

    setUploadState("uploading");
    setResult(null);

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const uploadResult = await processCsvUpload(formData);

        setResult(uploadResult);
        setUploadState(uploadResult.success ? "completed" : "error");
      } catch (e) {
        setResult({
          success: false,
          error: e instanceof Error ? e.message : "アップロード処理に失敗しました",
        });
        setUploadState("error");
      }
    });
  };

  const resetUpload = () => {
    setFile(null);
    setUploadState("idle");
    setResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <>
      {/* アップロードエリア */}
      {uploadState === "idle" && (
        <>
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className="rounded-2xl p-6 lg:p-12 text-center cursor-pointer transition-all duration-300"
            style={{
              border: isDragging ? "3px dashed #323232" : "3px dashed #e5e5e5",
              background: isDragging ? "#f9f9f9" : "#fff",
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <CloudUpload className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4 lg:mb-6" style={{ color: "#323232" }} />
            {file ? (
              <div>
                <p className="text-base lg:text-lg font-black mb-2 break-all" style={{ color: "#323232" }}>
                  {file.name}
                </p>
                <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <div>
                <p className="text-base lg:text-lg font-black mb-2" style={{ color: "#323232" }}>
                  <span className="hidden sm:inline">ファイルをドラッグ＆ドロップ</span>
                  <span className="sm:hidden">タップしてファイルを選択</span>
                </p>
                <p className="text-xs lg:text-sm font-bold hidden sm:block" style={{ color: "#323232" }}>
                  または<span className="font-black">クリックして選択</span>
                </p>
              </div>
            )}
          </div>

          {file && (
            <div className="mt-4 lg:mt-6 flex justify-end gap-3">
              <button
                onClick={resetUpload}
                disabled={isPending}
                className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 hover:bg-gray-100"
                style={{ color: "var(--text-muted)" }}
              >
                キャンセル
              </button>
              <button
                onClick={handleUpload}
                disabled={isPending}
                className="px-5 py-2 rounded-lg text-sm font-black transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--primary)", color: "#fff" }}
              >
                アップロード
              </button>
            </div>
          )}
        </>
      )}

      {/* アップロード中 */}
      {uploadState === "uploading" && (
        <div
          className="rounded-2xl p-4 lg:p-8"
          style={{ background: "#f9f9f9", border: "1px solid #e5e5e5" }}
        >
          <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
            <Loader2 className="w-5 lg:w-6 h-5 lg:h-6 animate-spin flex-shrink-0" style={{ color: "#323232" }} />
            <div>
              <p className="text-sm lg:text-base font-black" style={{ color: "#323232" }}>
                処理中<LoadingDots />
              </p>
              <p className="text-xs lg:text-sm font-bold break-all" style={{ color: "#323232" }}>
                {file?.name}
              </p>
            </div>
          </div>

          <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
            CSV解析・DB登録・エンベディング生成を実行しています。
          </p>
          <p className="text-xs mt-2 font-bold" style={{ color: "var(--text-muted)" }}>
            ※ この処理には数分かかることがあります。ページを閉じないでください。
          </p>
        </div>
      )}

      {/* 完了 */}
      {uploadState === "completed" && result && (
        <div
          className="rounded-2xl p-6 lg:p-8 text-center"
          style={{ background: "#f9f9f9", border: "1px solid #e5e5e5" }}
        >
          <Check className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4 lg:mb-6" style={{ color: "var(--success)" }} />
          <h3 className="text-lg lg:text-xl font-black mb-2" style={{ color: "#323232" }}>
            アップロード完了
          </h3>
          <div className="text-sm lg:text-base mb-4 lg:mb-6 font-bold space-y-1" style={{ color: "#323232" }}>
            <p>{(result.processed ?? 0).toLocaleString()}件のデータを登録しました</p>
            {result.embeddings && result.embeddings.succeeded > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                エンベディング: {result.embeddings.succeeded.toLocaleString()}件生成
                {result.embeddings.failed > 0 && (
                  <span style={{ color: "#dc2626" }}> / {result.embeddings.failed}件失敗</span>
                )}
              </p>
            )}
            {result.typicals && result.typicals.done > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                典型例: {result.typicals.done}件生成
              </p>
            )}
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={resetUpload}
              className="px-4 py-2 rounded-lg text-sm font-bold transition-all hover:bg-gray-100"
              style={{ color: "var(--text-muted)" }}
            >
              続けてアップロード
            </button>
            <Link
              href="/admin"
              className="px-5 py-2 rounded-lg text-sm font-black transition-all hover:opacity-90"
              style={{ background: "var(--primary)", color: "#fff" }}
            >
              学習データへ
            </Link>
          </div>
        </div>
      )}

      {/* エラー */}
      {uploadState === "error" && (
        <div
          className="rounded-2xl p-4 lg:p-8"
          style={{ background: "#fef2f2", border: "1px solid #fecaca" }}
        >
          <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
            <X className="w-5 lg:w-6 h-5 lg:h-6 flex-shrink-0" style={{ color: "#dc2626" }} />
            <div>
              <p className="text-sm lg:text-base font-black" style={{ color: "#dc2626" }}>
                アップロードエラー
              </p>
              <p className="text-xs lg:text-sm font-bold break-all" style={{ color: "#323232" }}>
                {file?.name}
              </p>
            </div>
          </div>

          {result?.error && (
            <p className="text-sm lg:text-base mb-3 lg:mb-4 font-bold" style={{ color: "#dc2626" }}>
              {result.error}
            </p>
          )}

          {result?.errors && result.errors.length > 0 && (
            <div className="mb-3 lg:mb-4 p-3 lg:p-4 rounded-lg" style={{ background: "#fff" }}>
              <p className="text-sm lg:text-base font-black mb-2" style={{ color: "#dc2626" }}>
                検証エラー ({result.errors.length}件):
              </p>
              <ul className="text-xs lg:text-sm space-y-1 font-bold" style={{ color: "#323232" }}>
                {result.errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {result.errors.length > 10 && (
                  <li>...他 {result.errors.length - 10}件のエラー</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={resetUpload}
              className="px-5 py-2 rounded-lg text-sm font-black transition-all hover:opacity-90"
              style={{ background: "var(--error)", color: "#fff" }}
            >
              やり直す
            </button>
          </div>
        </div>
      )}
    </>
  );
}
