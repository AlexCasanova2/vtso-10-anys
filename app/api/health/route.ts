import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const configured = {
    supabaseUrl: Boolean(url),
    anonKey: Boolean(anonKey),
    serviceRoleKey: Boolean(serviceKey),
    brevo: Boolean(process.env.BREVO_API_KEY && process.env.BREVO_SENDER_EMAIL),
  };

  if (!url || !serviceKey) {
    return NextResponse.json({ ok: false, configured, database: "not_checked" }, { status: 503 });
  }

  try {
    const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { error } = await supabase.from("events").select("id", { count: "exact", head: true });
    if (error) return NextResponse.json({ ok: false, configured, database: "error", error: error.message }, { status: 503 });
    return NextResponse.json({ ok: true, configured, database: "connected" });
  } catch (error) {
    return NextResponse.json({ ok: false, configured, database: "error", error: error instanceof Error ? error.message : "Unknown error" }, { status: 503 });
  }
}
