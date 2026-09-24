import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const params = new URL(request.url).searchParams;
  const eventId = params.get("eventId");
  const search = params.get("q")?.trim().replace(/[,%()]/g, "");
  if (!eventId) return apiError("Falta la jornada");
  const supabase = createAdminClient();
  let query = supabase.from("entries").select("id,number,created_at,email_snapshot,participants(id,first_name,last_name,email,document_type,document_number,document_country),email_deliveries(status,created_at)").eq("event_id", eventId).order("created_at", { ascending: false }).limit(1000);
  if (search) query = query.or(`first_name_snapshot.ilike.%${search}%,last_name_snapshot.ilike.%${search}%,email_snapshot.ilike.%${search}%,document_number_snapshot.ilike.%${search}%`);
  const { data, error } = await query;
  if (error) return apiError("No s'han pogut carregar els participants", 500);
  return NextResponse.json({ entries: data });
}
