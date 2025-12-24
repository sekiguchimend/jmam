// 旧URL: /predict
// 新URL: /dashboard
// ※middlewareでも /dashboard へ寄せるが、ページ単体でも安全にリダイレクトする

import { redirect } from "next/navigation";

export default async function PredictPage() {
  redirect("/dashboard");
}
