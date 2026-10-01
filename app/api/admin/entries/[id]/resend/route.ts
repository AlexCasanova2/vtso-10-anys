import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { sendTicketEmail } from "@/lib/brevo";
import { newEmailTrackingId } from "@/lib/email-tracking";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventDay } from "@/lib/types";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("entries").select("id,number,participant_id,event_id,email_snapshot,first_name_snapshot,events(*)").eq("id", id).single();
  if (!entry) return apiError("No s'ha trobat la participació", 404);
  const { data: related, error: relatedError } = await supabase.from("entries").select("id,number")
    .eq("event_id", entry.event_id).eq("participant_id", entry.participant_id).order("created_at").range(0, 999);
  if (relatedError || !related?.length) return apiError("No s'han pogut carregar els números del tiquet", 500);
  const trackingId = newEmailTrackingId();
  const { data: deliveries, error: deliveryError } = await supabase.from("email_deliveries")
    .insert(related.map((item) => ({ entry_id: item.id, recipient: entry.email_snapshot, provider_id: trackingId, status: "queued" }))).select("id");
  if (deliveryError || !deliveries?.length) return apiError("No s'ha pogut preparar el reenviament", 500);
  const deliveryIds = deliveries.map((delivery) => delivery.id);
  try {
    await sendTicketEmail({ to: entry.email_snapshot, firstName: entry.first_name_snapshot, numbers: related.map((item) => item.number), event: entry.events as unknown as EventDay, trackingId });
    await supabase.from("email_deliveries").update({ status: "sent", updated_at: new Date().toISOString() }).in("id", deliveryIds).eq("status", "queued");
    await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "entry.email_resent", entity_type: "entry", entity_id: id, payload: { recipient: entry.email_snapshot, numbers: related.map((item) => item.number) } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await supabase.from("email_deliveries").update({ status: "failed", error: error instanceof Error ? error.message : "Error", updated_at: new Date().toISOString() }).in("id", deliveryIds).eq("status", "queued");
    return apiError("Brevo no ha pogut enviar el correu", 502);
  }
}
