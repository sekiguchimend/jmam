import { Metadata } from "next";
import HelpPageClient from "./HelpPageClient";

export const metadata: Metadata = {
  title: "使い方ガイド",
  description: "スコア予測システムの使い方ガイド",
};

// 完全なSSGを有効化
export const dynamic = "force-static";

export default function HelpPage() {
  return <HelpPageClient />;
}
