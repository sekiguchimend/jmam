// 旧URL: /admin/login
// 初期画面は必ず /login に統一するため、ここは /login に誘導する

import { redirect } from "next/navigation";

export default function AdminLoginPage() {
  redirect("/login?redirect=/admin");
}

