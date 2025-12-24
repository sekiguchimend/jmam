// CSVアップロードフォーム（Client Component）
// FR-07〜FR-11: アップロード、検証、バッチ処理、進捗表示、エラー報告

"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/ui";
import { CloudUpload, Loader2, Check, X } from "lucide-react";

type UploadState = "idle" | "uploading" | "completed" | "error";

type SseEvent =
  | { event: "start"; data: { fileName: string } }
  | { event: "progress"; data: { fileName: string; processed: number; status: string } }
  | { event: "completed"; data: { fileName: string; processed: number; status: string } }
  | { event: "error"; data: { fileName?: string; error: string; errors?: string[] } };

async function countCsvDataLines(file: File): Promise<number> {
  // 行数（改行コード）をバイトで数える。文字コードに依存しない。
  const reader = file.stream().getReader();
  let newlines = 0;
  let hasAnyByte = false;

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    hasAnyByte = true;
    for (let i = 0; i < value.length; i += 1) {
      if (value[i] === 10) newlines += 1; // '\n'
    }
  }

  const totalLines = hasAnyByte ? newlines + 1 : 0;
  // 1行目はヘッダー想定。負数にならないようにガード。
  return Math.max(0, totalLines - 1);
}

async function readSseStream(
  response: Response,
  onEvent: (ev: SseEvent) => void
): Promise<void> {
  const body = response.body;
  if (!body) throw new Error("レスポンスボディが空です");

  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  const flush = (chunk: string) => {
    buffer += chunk;
    while (true) {
      const idx = buffer.indexOf("\n\n");
      if (idx === -1) break;
      const rawEvent = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);

      const lines = rawEvent.split("\n").filter(Boolean);
      const eventLine = lines.find((l) => l.startsWith("event:"));
      const dataLine = lines.find((l) => l.startsWith("data:"));
      if (!eventLine || !dataLine) continue;

      const event = eventLine.replace("event:", "").trim();
      const dataJson = dataLine.replace("data:", "").trim();
      try {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const data = JSON.parse(dataJson);
        onEvent({ event: event as SseEvent["event"], data } as SseEvent);
      } catch {
        // パースできない場合は無視
      }
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    flush(decoder.decode(value, { stream: true }));
  }

  flush(decoder.decode());
}

export function UploadClientForm() {
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [uploadState, setUploadState] = useState<UploadState>("idle");
  const [processedCount, setProcessedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
    setErrors([]);
    setErrorMessage(null);
    setProcessedCount(0);

    startTransition(async () => {
      try {
        // 進捗バー用に総行数（データ行）を事前に算出
        const total = await countCsvDataLines(file);
        setTotalCount(total);

        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/admin/upload", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`アップロードに失敗しました (${response.status})`);
        }

        await readSseStream(response, (ev) => {
          if (ev.event === "progress") {
            setProcessedCount(ev.data.processed ?? 0);
            return;
          }
          if (ev.event === "completed") {
            setProcessedCount(ev.data.processed ?? 0);
            setUploadState("completed");
            return;
          }
          if (ev.event === "error") {
            setUploadState("error");
            setErrorMessage(ev.data.error);
            if (ev.data.errors) setErrors(ev.data.errors);
          }
        });
      } catch (e) {
        setUploadState("error");
        setErrorMessage(e instanceof Error ? e.message : "アップロード処理に失敗しました");
      }
    });
  };

  const resetUpload = () => {
    setFile(null);
    setUploadState("idle");
    setProcessedCount(0);
    setTotalCount(0);
    setErrors([]);
    setErrorMessage(null);
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
            <div className="mt-4 lg:mt-6 flex flex-col sm:flex-row gap-3 lg:gap-4">
              <button
                onClick={handleUpload}
                disabled={isPending}
                className="flex-1 py-3 lg:py-4 rounded-xl font-black text-base lg:text-lg transition-all hover:opacity-90 disabled:opacity-50"
                style={{ background: "#323232", color: "#fff" }}
              >
                アップロード開始
              </button>
              <button
                onClick={resetUpload}
                disabled={isPending}
                className="px-6 py-3 lg:py-4 rounded-xl font-bold transition-all disabled:opacity-50"
                style={{ border: "2px solid #e5e5e5", color: "#323232" }}
              >
                キャンセル
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
                アップロード中...
              </p>
              <p className="text-xs lg:text-sm font-bold break-all" style={{ color: "#323232" }}>
                {file?.name}
              </p>
            </div>
          </div>

          <div className="mb-3 lg:mb-4">
            <ProgressBar current={processedCount} total={Math.max(totalCount, 1)} />
          </div>

          <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
            データを検証・登録しています。このページを閉じないでください。
          </p>
        </div>
      )}

      {/* 完了 */}
      {uploadState === "completed" && (
        <div
          className="rounded-2xl p-6 lg:p-8 text-center"
          style={{ background: "#f9f9f9", border: "1px solid #e5e5e5" }}
        >
          <Check className="w-10 lg:w-12 h-10 lg:h-12 mx-auto mb-4 lg:mb-6" style={{ color: "var(--success)" }} />
          <h3 className="text-lg lg:text-xl font-black mb-2" style={{ color: "#323232" }}>
            アップロード完了
          </h3>
          <p className="text-sm lg:text-base mb-4 lg:mb-6 font-bold" style={{ color: "#323232" }}>
            {processedCount.toLocaleString()}件のデータが正常に登録されました
          </p>
          <div className="flex flex-col sm:flex-row gap-3 lg:gap-4 justify-center">
            <Link
              href="/admin"
              className="px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl font-black text-sm lg:text-base transition-all hover:opacity-90"
              style={{ background: "#323232", color: "#fff" }}
            >
              学習データへ
            </Link>
            <button
              onClick={resetUpload}
              className="px-5 lg:px-6 py-2.5 lg:py-3 rounded-xl font-bold text-sm lg:text-base transition-all"
              style={{ border: "2px solid #323232", color: "#323232" }}
            >
              続けてアップロード
            </button>
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

          {errorMessage && (
            <p className="text-sm lg:text-base mb-3 lg:mb-4 font-bold" style={{ color: "#dc2626" }}>
              {errorMessage}
            </p>
          )}

          {errors.length > 0 && (
            <div className="mb-3 lg:mb-4 p-3 lg:p-4 rounded-lg" style={{ background: "#fff" }}>
              <p className="text-sm lg:text-base font-black mb-2" style={{ color: "#dc2626" }}>
                検証エラー ({errors.length}件):
              </p>
              <ul className="text-xs lg:text-sm space-y-1 font-bold" style={{ color: "#323232" }}>
                {errors.slice(0, 10).map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
                {errors.length > 10 && (
                  <li>...他 {errors.length - 10}件のエラー</li>
                )}
              </ul>
            </div>
          )}

          <button
            onClick={resetUpload}
            className="w-full py-2.5 lg:py-3 rounded-xl font-black text-sm lg:text-base transition-all"
            style={{ border: "2px solid #dc2626", color: "#dc2626" }}
          >
            やり直す
          </button>
        </div>
      )}
    </>
  );
}
