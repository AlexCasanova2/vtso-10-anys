import { NextResponse } from "next/server";
import { apiError, databaseMessage } from "@/lib/api";
import { sendTicketEmail } from "@/lib/brevo";
import { newEmailTrackingId } from "@/lib/email-tracking";
import { hashInvitationToken } from "@/lib/invitation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventDay } from "@/lib/types";
import { registrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");

  const values = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("complete_ticket_invitation", {
    p_token_hash: hashInvitationToken(values.token),
    p_last_name: values.lastName,
    p_document_type: values.documentType,
    p_document_number: values.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    p_document_country: values.documentType === "passport" ? values.documentCountry : "ES",
    p_legal_accepted: values.legalAccepted,
  });
  if (error) return apiError(databaseMessage(error.message));

  const entries = data as { entry_id: string; assigned_number: number; event_id: string; recipient: string; first_name: string }[] | null;
  if (!entries?.length) return apiError("No s'han pogut assignar els números", 500);
  const first = entries[0];
  const numbers = entries.map((entry) => entry.assigned_number);
  const { data: firstEntry } = await supabase.from("entries").select("participant_id").eq("id", first.entry_id).single();
  const { data: related, error: relatedError } = firstEntry
    ? await supabase.from("entries").select("id,number").eq("event_id", first.event_id)
      .eq("participant_id", firstEntry.participant_id).order("created_at").range(0, 999)
    : { data: null, error: null };
  if (relatedError || !related?.length) {
    console.error("Participació confirmada però no disponible per al correu", relatedError);
    return NextResponse.json({ emailSent: false });
  }

  const { data: event } = await supabase.from("events").select("*").eq("id", first.event_id).single();
  const trackingId = newEmailTrackingId();
  const { data: deliveries, error: deliveryError } = await supabase.from("email_deliveries")
    .insert(related.map((entry) => ({ entry_id: entry.id, recipient: first.recipient,
      provider_id: trackingId, status: "queued" }))).select("id");
  if (deliveryError) console.error("No s'han pogut crear els registres d'enviament", deliveryError);

  let emailSent = false;
  try {
    await sendTicketEmail({ to: first.recipient, firstName: first.first_name,
      numbers: related.map((entry) => entry.number), event: event as EventDay, trackingId });
    emailSent = true;
    if (deliveries?.length) await supabase.from("email_deliveries")
      .update({ status: "sent", updated_at: new Date().toISOString() })
      .in("id", deliveries.map((delivery) => delivery.id)).eq("status", "queued");
  } catch (cause) {
    console.error("Participació confirmada però correu no enviat", cause);
    if (deliveries?.length) await supabase.from("email_deliveries")
      .update({ status: "failed", error: cause instanceof Error ? cause.message : "Error desconegut",
        updated_at: new Date().toISOString() })
      .in("id", deliveries.map((delivery) => delivery.id)).eq("status", "queued");
  }

  await supabase.from("audit_logs").insert({ action: "ticket.registered", entity_type: "entry",
    entity_id: first.entry_id, payload: { event_id: first.event_id, numbers, email_sent: emailSent } });
  return NextResponse.json({ emailSent });
}
