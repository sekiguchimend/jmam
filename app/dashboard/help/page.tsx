import { Metadata } from "next";
import HelpContent from "./HelpContent";

export const metadata: Metadata = {
  title: "使い方ガイド",
  description: "スコア予測システムの使い方ガイド",
};

// 認証・レイアウトはlayout.tsxで処理
export default function HelpPage() {
  return <HelpContent />;
}
