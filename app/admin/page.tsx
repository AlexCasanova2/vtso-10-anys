import { redirect } from "next/navigation";
import { AdminDashboard } from "@/components/admin-dashboard";
import { getAdmin } from "@/lib/auth";

export default async function AdminPage() {
  const user = await getAdmin();
  if (!user) redirect("/admin/login");
  return <AdminDashboard user={user} />;
}
