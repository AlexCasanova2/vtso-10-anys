import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const search = new URL(request.url).searchParams.get("q")?.trim().replace(/[,%()]/g, "");
  const supabase = createAdminClient();
  let query = supabase.from("participants").select("id,first_name,last_name,email,document_type,document_number,document_country,entries(id,number,created_at,events(id,name),draws(status))").order("updated_at", { ascending: false }).limit(300);
  if (search) query = query.or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,document_number.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return apiError("No s'ha pogut carregar el CRM", 500);
  return NextResponse.json({ participants: data });
}
