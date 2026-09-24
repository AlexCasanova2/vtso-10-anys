import { createClient } from "@/lib/supabase/server";

export async function getAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase.from("profiles").select("id, full_name, role").eq("id", user.id).single();
  if (!profile || !["admin", "operator"].includes(profile.role)) return null;
  return { ...profile, email: user.email ?? "" } as { id: string; full_name: string; role: "admin" | "operator"; email: string };
}
