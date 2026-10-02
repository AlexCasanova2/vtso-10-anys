import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const eventId = z.uuid().safeParse(new URL(request.url).searchParams.get("eventId"));
  if (!eventId.success) return apiError("Jornada no vàlida");

  const { data, error } = await createAdminClient().from("pending_ticket_registrations")
    .select("id,ticket_code,amount_cents,first_name,email,email_sent_at,expires_at")
    .eq("event_id", eventId.data).is("completed_at", null)
    .order("created_at", { ascending: false }).range(0, 999);
  if (error) return apiError("No s'han pogut carregar les invitacions pendents", 500);
  return NextResponse.json({ invitations: data }, { headers: { "Cache-Control": "no-store" } });
}
