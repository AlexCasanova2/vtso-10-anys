import { NextResponse } from "next/server";
import { apiError, databaseMessage, requireApiAdmin } from "@/lib/api";
import { sendTicketEmail } from "@/lib/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { staffRegistrationSchema } from "@/lib/validation";
import type { EventDay } from "@/lib/types";

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const parsed = staffRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");

  const values = parsed.data;
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("register_ticket", {
    p_event_id: values.eventId,
    p_first_name: values.firstName,
    p_last_name: values.lastName,
    p_email: values.email,
    p_document_type: values.documentType,
    p_document_number: values.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
    p_document_country: values.documentType === "passport" ? values.documentCountry : "ES",
    p_ticket_code: values.ticketCode,
    p_amount_cents: values.amountCents,
    p_actor_id: auth.user.id,
  });
  if (error) return apiError(databaseMessage(error.message));

  const entries = data as { entry_id: string; assigned_number: number }[] | null;
  if (!entries?.length) return apiError("No s'han pogut assignar els números", 500);
  const numbers = entries.map((entry) => entry.assigned_number);
  const { data: firstEntry } = await supabase.from("entries").select("participant_id").eq("id", entries[0].entry_id).single();
  const { data: allEntries, error: allEntriesError } = firstEntry
    ? await supabase.from("entries").select("id,number").eq("event_id", values.eventId).eq("participant_id", firstEntry.participant_id).order("created_at").range(0, 999)
    : { data: null, error: null };
  if (allEntriesError || !allEntries?.length) {
    console.error("Números assignats però no disponibles per al correu", allEntriesError);
    return NextResponse.json({ entryIds: entries.map((entry) => entry.entry_id), numbers, emailSent: false });
  }
  const { data: event } = await supabase.from("events").select("*").eq("id", values.eventId).single();
  const { data: deliveries, error: deliveryError } = await supabase.from("email_deliveries")
    .insert(allEntries.map((entry) => ({ entry_id: entry.id, recipient: values.email, status: "queued" }))).select("id");
  if (deliveryError) console.error("No s'han pogut crear els registres d'enviament", deliveryError);

  let emailSent = false;
  try {
    const sent = await sendTicketEmail({ to: values.email, firstName: values.firstName, numbers: allEntries.map((entry) => entry.number), event: event as EventDay });
    emailSent = true;
    if (deliveries?.length) await supabase.from("email_deliveries").update({ status: "sent", provider_id: sent.messageId, updated_at: new Date().toISOString() }).in("id", deliveries.map((delivery) => delivery.id));
  } catch (emailError) {
    if (deliveries?.length) await supabase.from("email_deliveries").update({ status: "failed", error: emailError instanceof Error ? emailError.message : "Error desconegut", updated_at: new Date().toISOString() }).in("id", deliveries.map((delivery) => delivery.id));
  }

  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "ticket.registered", entity_type: "entry", entity_id: entries[0].entry_id, payload: { event_id: values.eventId, ticket_code: values.ticketCode, amount_cents: values.amountCents, numbers, email_sent: emailSent } });
  return NextResponse.json({ entryIds: entries.map((entry) => entry.entry_id), numbers, emailSent });
}
