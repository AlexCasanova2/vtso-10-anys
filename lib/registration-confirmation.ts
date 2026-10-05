import { sendTicketEmail } from "@/lib/brevo";
import { newEmailTrackingId } from "@/lib/email-tracking";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventDay } from "@/lib/types";

export async function sendRegistrationConfirmation(entryId: string, eventId: string, recipient: string, firstName: string) {
  const supabase = createAdminClient();
  const { data: firstEntry } = await supabase.from("entries").select("participant_id").eq("id", entryId).single();
  const { data: related, error: relatedError } = firstEntry
    ? await supabase.from("entries").select("id,number").eq("event_id", eventId)
      .eq("participant_id", firstEntry.participant_id).order("created_at").range(0, 999)
    : { data: null, error: null };
  if (relatedError || !related?.length) {
    console.error("Participació confirmada però no disponible per al correu", relatedError);
    return false;
  }
  const { data: event } = await supabase.from("events").select("*").eq("id", eventId).single();
  const trackingId = newEmailTrackingId();
  const { data: deliveries, error: deliveryError } = await supabase.from("email_deliveries")
    .insert(related.map((entry) => ({ entry_id: entry.id, recipient, provider_id: trackingId, status: "queued" }))).select("id");
  if (deliveryError) console.error("No s'han pogut crear els registres d'enviament", deliveryError);
  let emailSent = false;
  try {
    await sendTicketEmail({ to: recipient, firstName, numbers: related.map((entry) => entry.number), event: event as EventDay, trackingId });
    emailSent = true;
    if (deliveries?.length) await supabase.from("email_deliveries")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .in("id", deliveries.map((delivery) => delivery.id)).eq("status", "queued");
  } catch (cause) {
    console.error("Participació confirmada però correu no enviat", cause);
    if (deliveries?.length) await supabase.from("email_deliveries")
      .update({ status: "failed", error: cause instanceof Error ? cause.message : "Error desconegut", updated_at: new Date().toISOString() })
      .in("id", deliveries.map((delivery) => delivery.id)).eq("status", "queued");
  }
  return emailSent;
}
