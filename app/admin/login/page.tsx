import { redirect } from "next/navigation";
import { AdminLogin } from "@/components/admin-login";
import { getAdmin } from "@/lib/auth";

export default async function LoginPage() {
  if (await getAdmin()) redirect("/admin");
  return <AdminLogin />;
}
