import { Metadata } from "next";
import { getUserWithRole } from "@/lib/supabase/server";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import HelpClient from "./HelpClient";

export const metadata: Metadata = {
  title: "使い方 - スコア予測システム",
  description: "スコア予測システムの使い方ガイド",
};

export default async function HelpPage() {
  const userInfo = await getUserWithRole();

  return (
    <DashboardLayout
      isAdmin={userInfo.isAdmin}
      userName={userInfo.name}
      userEmail={userInfo.email}
    >
      <HelpClient />
    </DashboardLayout>
  );
}
