"use client";

import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

// フォントデータキャッシュ
let regularFontBase64: string | null = null;
let boldFontBase64: string | null = null;

/**
 * 日本語フォントを読み込んでjsPDFに登録
 */
async function loadJapaneseFont(pdf: jsPDF): Promise<void> {
  try {
    // フォントデータをキャッシュから取得、なければfetch
    if (!regularFontBase64 || !boldFontBase64) {
      // Regular フォント (M+ Fonts)
      const regularResponse = await fetch("/fonts/mplus-regular.ttf");
      const regularBuffer = await regularResponse.arrayBuffer();
      regularFontBase64 = btoa(
        new Uint8Array(regularBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );

      // Bold フォント (M+ Fonts)
      const boldResponse = await fetch("/fonts/mplus-bold.ttf");
      const boldBuffer = await boldResponse.arrayBuffer();
      boldFontBase64 = btoa(
        new Uint8Array(boldBuffer).reduce(
          (data, byte) => data + String.fromCharCode(byte),
          ""
        )
      );
    }

    // 毎回PDFインスタンスにフォントを追加
    pdf.addFileToVFS("mplus-regular.ttf", regularFontBase64);
    pdf.addFileToVFS("mplus-bold.ttf", boldFontBase64);
    pdf.addFont("mplus-regular.ttf", "MPlus", "normal");
    pdf.addFont("mplus-bold.ttf", "MPlus", "bold");
    pdf.setFont("MPlus", "bold");
  } catch (error) {
    console.warn("Failed to load Japanese font, falling back to default:", error);
  }
}

// 解答予測結果のエクスポート用データ型
export interface AnswerPredictExportData {
  caseName: string;
  situationText?: string;
  scores: {
    label: string;
    value: number;
    max: number;
  }[];
  roleScore: number;
  q1Answer: string;
  q2Answer: string;
  q1Reason?: string;
  q2Reason?: string;
}

// スコア予測結果のエクスポート用データ型
export interface ScorePredictExportData {
  caseName: string;
  situationText?: string;
  questionLabel: string;
  answerText: string;
  confidence: number;
  scores: {
    label: string;
    value: number;
    children?: { label: string; value: number }[];
  }[];
  explanation: string;
  similarExamples?: {
    rank: number;
    similarity: number;
    excerpt: string;
  }[];
}

/**
 * 解答予測結果をテーブル形式でPDFにエクスポート
 */
export async function exportAnswerPredictToPdf(
  data: AnswerPredictExportData,
  filename: string
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 日本語フォントを読み込み
  await loadJapaneseFont(pdf);

  const margin = 15;
  let y = margin;

  // タイトル
  pdf.setFontSize(18);
  pdf.setFont("MPlus", "bold");
  pdf.text("解答予測結果", margin, y);
  y += 12;

  // ケース名と日時
  pdf.setFontSize(11);
  pdf.setTextColor(80);
  pdf.text(`ケース: ${data.caseName}`, margin, y);
  y += 6;
  pdf.text(`出力日時: ${new Date().toLocaleString("ja-JP")}`, margin, y);
  y += 12;

  pdf.setTextColor(0);

  // シチュエーション（ケースの具体的な内容）
  if (data.situationText) {
    pdf.setFontSize(14);
    pdf.setFont("MPlus", "bold");
    pdf.text("ケース内容", margin, y);
    y += 7;

    autoTable(pdf, {
      startY: y,
      body: [[data.situationText]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 180 } },
    });

    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // 目標スコアテーブル
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("目標スコア", margin, y);
  y += 7;

  // 問題把握と対策立案のスコアを取得して総合スコアを計算
  const problemScore = data.scores.find(s => s.label === "問題把握")?.value ?? 0;
  const solutionScore = data.scores.find(s => s.label === "対策立案")?.value ?? 0;
  const overallScore = Math.round(((problemScore + solutionScore + data.roleScore) / 3) * 10) / 10;

  const scoreRows = data.scores.map((s) => [s.label, `${s.value}`, `/ ${s.max}`]);
  scoreRows.push(["役割理解（自動計算）", `${data.roleScore.toFixed(1)}`, "/ 5"]);
  scoreRows.push(["総合スコア", `${overallScore.toFixed(1)}`, "/ 5"]);

  autoTable(pdf, {
    startY: y,
    head: [["項目", "スコア", "最大"]],
    body: scoreRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3, font: "MPlus", fontStyle: "bold" },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, font: "MPlus", fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 30, halign: "center" },
      2: { cellWidth: 30, halign: "center" },
    },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // 設問1の解答
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("設問1 - 予測解答", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.q1Answer]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // 設問2の解答
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("設問2 - 予測解答", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.q2Answer]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  pdf.save(`${filename}.pdf`);
}

/**
 * スコア予測結果をテーブル形式でPDFにエクスポート
 */
export async function exportScorePredictToPdf(
  data: ScorePredictExportData,
  filename: string
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 日本語フォントを読み込み
  await loadJapaneseFont(pdf);

  const margin = 15;
  let y = margin;

  // タイトル
  pdf.setFontSize(18);
  pdf.setFont("MPlus", "bold");
  pdf.text(`スコア予測結果 - ${data.questionLabel}`, margin, y);
  y += 12;

  // ケース名と日時
  pdf.setFontSize(11);
  pdf.setTextColor(80);
  pdf.text(`ケース: ${data.caseName}`, margin, y);
  y += 6;
  pdf.text(`出力日時: ${new Date().toLocaleString("ja-JP")}`, margin, y);
  y += 6;
  pdf.text(`信頼度: ${(data.confidence * 100).toFixed(0)}%`, margin, y);
  y += 12;

  pdf.setTextColor(0);

  // シチュエーション（ケースの具体的な内容）
  if (data.situationText) {
    pdf.setFontSize(14);
    pdf.setFont("MPlus", "bold");
    pdf.text("ケース内容", margin, y);
    y += 7;

    autoTable(pdf, {
      startY: y,
      body: [[data.situationText]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 180 } },
    });

    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // 解答テキスト
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("入力した解答", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.answerText]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // 予測スコアテーブル
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("予測スコア", margin, y);
  y += 7;

  const scoreRows: string[][] = [];
  for (const score of data.scores) {
    scoreRows.push([score.label, score.value.toFixed(1)]);
    if (score.children) {
      for (const child of score.children) {
        scoreRows.push([`  └ ${child.label}`, child.value.toString()]);
      }
    }
  }

  autoTable(pdf, {
    startY: y,
    head: [["項目", "スコア"]],
    body: scoreRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3, font: "MPlus", fontStyle: "bold" },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, font: "MPlus", fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 40, halign: "center" },
    },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // 説明
  if (y > 240) {
    pdf.addPage();
    y = margin;
  }

  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("予測の説明", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.explanation]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // 類似例（あれば）
  if (data.similarExamples && data.similarExamples.length > 0) {
    if (y > 220) {
      pdf.addPage();
      y = margin;
    }

    pdf.setFontSize(14);
    pdf.setFont("MPlus", "bold");
    pdf.text("類似解答例", margin, y);
    y += 7;

    const exampleRows = data.similarExamples.map((ex) => [
      `#${ex.rank}`,
      `${(ex.similarity * 100).toFixed(0)}%`,
      ex.excerpt,
    ]);

    autoTable(pdf, {
      startY: y,
      head: [["順位", "類似度", "抜粋"]],
      body: exampleRows,
      margin: { left: margin, right: margin },
      styles: { fontSize: 9, cellPadding: 4, font: "MPlus", fontStyle: "bold" },
      headStyles: { fillColor: [99, 102, 241], textColor: 255, font: "MPlus", fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: 18, halign: "center" },
        1: { cellWidth: 25, halign: "center" },
        2: { cellWidth: 137 },
      },
    });
  }

  pdf.save(`${filename}.pdf`);
}

// 新規ケース予測結果のエクスポート用データ型
export interface NewCasePredictExportData {
  caseName: string;
  situationText?: string;
  q1Answer: string;
  q2Answer: string;
  confidence: number;
  scores: {
    label: string;
    value: number;
    children?: { label: string; value: number }[];
  }[];
  explanation: string;
}

/**
 * 新規ケース予測結果をテーブル形式でPDFにエクスポート
 */
export async function exportNewCasePredictToPdf(
  data: NewCasePredictExportData,
  filename: string
): Promise<void> {
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  // 日本語フォントを読み込み
  await loadJapaneseFont(pdf);

  const margin = 15;
  let y = margin;

  // タイトル
  pdf.setFontSize(18);
  pdf.setFont("MPlus", "bold");
  pdf.text("スコア予測結果", margin, y);
  y += 12;

  // ケース名と日時
  pdf.setFontSize(11);
  pdf.setTextColor(80);
  pdf.text(`ケース: ${data.caseName}`, margin, y);
  y += 6;
  pdf.text(`出力日時: ${new Date().toLocaleString("ja-JP")}`, margin, y);
  y += 6;
  pdf.text(`信頼度: ${(data.confidence * 100).toFixed(0)}%`, margin, y);
  y += 12;

  pdf.setTextColor(0);

  // シチュエーション（ケースの具体的な内容）
  if (data.situationText) {
    pdf.setFontSize(14);
    pdf.setFont("MPlus", "bold");
    pdf.text("ケース内容", margin, y);
    y += 7;

    autoTable(pdf, {
      startY: y,
      body: [[data.situationText]],
      margin: { left: margin, right: margin },
      styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 180 } },
    });

    y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  }

  // 設問1の解答
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("設問1の解答（問題把握）", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.q1Answer]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;

  // 設問2の解答
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("設問2の解答（対策立案）", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.q2Answer]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // ページ確認
  if (y > 200) {
    pdf.addPage();
    y = margin;
  }

  // 予測スコアテーブル
  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("予測スコア", margin, y);
  y += 7;

  const scoreRows: string[][] = [];
  for (const score of data.scores) {
    scoreRows.push([score.label, score.value.toFixed(1)]);
    if (score.children) {
      for (const child of score.children) {
        scoreRows.push([`  └ ${child.label}`, child.value.toString()]);
      }
    }
  }

  autoTable(pdf, {
    startY: y,
    head: [["項目", "スコア"]],
    body: scoreRows,
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 3, font: "MPlus", fontStyle: "bold" },
    headStyles: { fillColor: [99, 102, 241], textColor: 255, font: "MPlus", fontStyle: "bold" },
    alternateRowStyles: { fillColor: [245, 245, 250] },
    columnStyles: {
      0: { cellWidth: 100 },
      1: { cellWidth: 40, halign: "center" },
    },
  });

  y = (pdf as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;

  // 説明
  if (y > 240) {
    pdf.addPage();
    y = margin;
  }

  pdf.setFontSize(14);
  pdf.setFont("MPlus", "bold");
  pdf.text("予測の説明", margin, y);
  y += 7;

  autoTable(pdf, {
    startY: y,
    body: [[data.explanation]],
    margin: { left: margin, right: margin },
    styles: { fontSize: 10, cellPadding: 5, font: "MPlus", fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: 180 } },
  });

  pdf.save(`${filename}.pdf`);
}
