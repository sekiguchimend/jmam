// CSVアップロードフォーム（Client Component）
// FR-07〜FR-11: アップロード、検証、バッチ処理、進捗表示、エラー報告

"use client";

import { useEffect, useState, useRef, useTransition } from "react";
import Link from "next/link";
import { ProgressBar } from "@/components/ui";
import { CloudUpload, Loader2, Check, X } from "lucide-react";
import { iterateCsvRecordsFromBytes, parseCSVLine } from "@/lib/utils";

type UploadState = "idle" | "uploading" | "preparing" | "completed" | "error";

type SseEvent =
  | { event: "start"; data: { fileName: string } }
  | { event: "progress"; data: { fileName: string; processed: number; status: string } }
  | { event: "completed"; data: { fileName: string; processed: number; status: string } }
  | { event: "prepare_start"; data: { status: string } }
  | { event: "prepare_progress"; data: { phase: string; processed?: number; succeeded?: number; failed?: number; done?: number; total?: number } }
  | { event: "prepare_done"; data: { status: string; embeddings: { processed: number; succeeded: number; failed: number }; typicals: { done: number; scheduled: number }; timeMs: number } }
  | { event: "error"; data: { fileName?: string; error: string; errors?: string[] } };

const REQUIRED_HEADERS = ["受注番号", "Ⅱ　MC　題材コード"] as const;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function LoadingDots() {
  return (
    <span className="inline-flex items-center gap-1 ml-1" aria-hidden="true">
      <span className="w-1.5 h-1.5 rounded-full bg-[#323232] animate-bounce" style={{ animationDelay: "0ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#323232] animate-bounce" style={{ animationDelay: "150ms" }} />
      <span className="w-1.5 h-1.5 rounded-full bg-[#323232] animate-bounce" style={{ animationDelay: "300ms" }} />
    </span>
  );
}

async function detectEncodingForCsv(file: File): Promise<string> {
  const prefix = new Uint8Array(await file.slice(0, 64 * 1024).arrayBuffer());

  const tryDecode = (encoding: string) => {
    try {
      return new TextDecoder(encoding as never, { fatal: false }).decode(prefix);
    } catch {
      return "";
    }
  };

  const looksOk = (text: string) =>
    text.includes("受注番号") || text.includes("題材コード") || text.includes("Ⅱ") || text.includes("MC");

  const utf8 = tryDecode("utf-8");
  if (looksOk(utf8)) return "utf-8";

  const sjis = tryDecode("shift-jis");
  if (looksOk(sjis)) return "shift-jis";

  return "utf-8";
}

async function countCsvDataLinesFallback(file: File): Promise<number> {
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

async function countCsvDataRecords(file: File): Promise<number> {
  // セル内改行があるCSVだと、改行数ベースのカウントはズレるためレコード単位で数える。
  // ただしヘッダーが見つからない等の異常系ではフォールバックする。
  const encoding = await detectEncodingForCsv(file);

  let headersFound = false;
  let headerAttempts = 0;
  let total = 0;

  for await (const record of iterateCsvRecordsFromBytes(file.stream(), encoding)) {
    if (!record.trim()) continue;

    if (!headersFound) {
      const headers = parseCSVLine(record);
      const valid = REQUIRED_HEADERS.every((h) => headers.includes(h));
      if (valid) {
        headersFound = true;
        continue;
      }

      headerAttempts += 1;
      if (headerAttempts < 5) continue;
      return await countCsvDataLinesFallback(file);
    }

    total += 1;
  }

  if (!headersFound) return await countCsvDataLinesFallback(file);
  return total;
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
        const data = JSON.parse(dataJson) as unknown;
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
  const [elapsedMs, setElapsedMs] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // エンベディング生成の進捗
  const [embeddingProcessed, setEmbeddingProcessed] = useState(0);
  const [embeddingSucceeded, setEmbeddingSucceeded] = useState(0);
  const [embeddingFailed, setEmbeddingFailed] = useState(0);
  const [preparePhase, setPreparePhase] = useState<"embeddings" | "typicals">("embeddings");
  const [typicalsDone, setTypicalsDone] = useState(0);
  const [typicalsTotal, setTypicalsTotal] = useState(0);

  useEffect(() => {
    if (uploadState !== "uploading") {
      setElapsedMs(0);
      return;
    }
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setElapsedMs(Date.now() - startedAt);
    }, 500);
    return () => clearInterval(timer);
  }, [uploadState]);

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
        // 進捗バー用に総件数（データレコード）を事前に算出
        const total = await countCsvDataRecords(file);
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
            // CSVアップロード完了後、エンベディング生成が始まるのを待つ
            return;
          }
          if (ev.event === "prepare_start") {
            setUploadState("preparing");
            setEmbeddingProcessed(0);
            setEmbeddingSucceeded(0);
            setEmbeddingFailed(0);
            setPreparePhase("embeddings");
            return;
          }
          if (ev.event === "prepare_progress") {
            if (ev.data.phase === "embeddings") {
              setPreparePhase("embeddings");
              setEmbeddingProcessed(ev.data.processed ?? 0);
              setEmbeddingSucceeded(ev.data.succeeded ?? 0);
              setEmbeddingFailed(ev.data.failed ?? 0);
            } else if (ev.data.phase === "typicals") {
              setPreparePhase("typicals");
              setTypicalsDone(ev.data.done ?? 0);
              setTypicalsTotal(ev.data.total ?? 0);
            }
            return;
          }
          if (ev.event === "prepare_done") {
            setEmbeddingProcessed(ev.data.embeddings.processed);
            setEmbeddingSucceeded(ev.data.embeddings.succeeded);
            setEmbeddingFailed(ev.data.embeddings.failed);
            setTypicalsDone(ev.data.typicals.done);
            setTypicalsTotal(ev.data.typicals.scheduled);
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
    setEmbeddingProcessed(0);
    setEmbeddingSucceeded(0);
    setEmbeddingFailed(0);
    setPreparePhase("embeddings");
    setTypicalsDone(0);
    setTypicalsTotal(0);
    // input の value をリセットして同じファイルを再選択可能にする
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
                アップロード中<LoadingDots />
              </p>
              <p className="text-xs lg:text-sm font-bold break-all" style={{ color: "#323232" }}>
                {file?.name}
              </p>
            </div>
          </div>

          <div className="mb-3 lg:mb-4">
            <ProgressBar current={processedCount} total={Math.max(totalCount, 1)} animated />
          </div>

          <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
            {totalCount > 0 ? (
              <>
                進捗: {processedCount.toLocaleString()} / {totalCount.toLocaleString()} 件（
                {Math.max(0, Math.min(100, Math.round((processedCount / totalCount) * 100)))}%）・経過{" "}
                {formatElapsed(elapsedMs)}
              </>
            ) : (
              <>総件数を計算中です。少しお待ちください（経過 {formatElapsed(elapsedMs)}）</>
            )}
          </p>
        </div>
      )}

      {/* エンベディング生成中 */}
      {uploadState === "preparing" && (
        <div
          className="rounded-2xl p-4 lg:p-8"
          style={{ background: "#f0f9ff", border: "1px solid #bae6fd" }}
        >
          <div className="flex items-center gap-3 lg:gap-4 mb-4 lg:mb-6">
            <Loader2 className="w-5 lg:w-6 h-5 lg:h-6 animate-spin flex-shrink-0" style={{ color: "#0284c7" }} />
            <div>
              <p className="text-sm lg:text-base font-black" style={{ color: "#0284c7" }}>
                {preparePhase === "embeddings" ? "エンベディング生成中" : "典型例生成中"}<LoadingDots />
              </p>
              <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
                データ登録完了（{processedCount.toLocaleString()}件）
              </p>
            </div>
          </div>

          <div className="mb-3 lg:mb-4">
            {preparePhase === "embeddings" ? (
              <ProgressBar
                current={embeddingProcessed}
                total={Math.max(processedCount * 2, embeddingProcessed + 1)}
                animated
              />
            ) : (
              <ProgressBar
                current={typicalsDone}
                total={Math.max(typicalsTotal, 1)}
                animated
              />
            )}
          </div>

          <p className="text-xs lg:text-sm font-bold" style={{ color: "#323232" }}>
            {preparePhase === "embeddings" ? (
              <>
                エンベディング: {embeddingSucceeded.toLocaleString()} 件成功
                {embeddingFailed > 0 && <span style={{ color: "#dc2626" }}> / {embeddingFailed} 件失敗</span>}
                ・経過 {formatElapsed(elapsedMs)}
              </>
            ) : (
              <>
                典型例: {typicalsDone} / {typicalsTotal} 件・経過 {formatElapsed(elapsedMs)}
              </>
            )}
          </p>
          <p className="text-xs mt-2 font-bold" style={{ color: "var(--text-muted)" }}>
            ※ この処理には数分かかることがあります。ページを閉じないでください。
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
          <div className="text-sm lg:text-base mb-4 lg:mb-6 font-bold space-y-1" style={{ color: "#323232" }}>
            <p>{processedCount.toLocaleString()}件のデータを登録しました</p>
            {embeddingSucceeded > 0 && (
              <p className="text-xs" style={{ color: "var(--text-muted)" }}>
                エンベディング: {embeddingSucceeded.toLocaleString()}件生成
                {embeddingFailed > 0 && <span style={{ color: "#dc2626" }}> / {embeddingFailed}件失敗</span>}
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
