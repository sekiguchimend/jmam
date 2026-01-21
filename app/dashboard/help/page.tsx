import { Metadata } from "next";
import HelpClient from "./HelpClient";

export const metadata: Metadata = {
  title: "使い方 - スコア予測システム",
  description: "スコア予測システムの使い方ガイド",
};

export default function HelpPage() {
  return <HelpClient />;
}
