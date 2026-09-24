import { NextResponse } from "next/server";
import { apiError, databaseMessage } from "@/lib/api";
import { sendTicketEmail } from "@/lib/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import { registrationSchema } from "@/lib/validation";
import type { EventDay } from "@/lib/types";

export async function POST(request: Request) {
  const parsed = registrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");

  const values = parsed.data;
  const supabase = createAdminClient();
  const normalizedDocument = values.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const { data, error } = await supabase.rpc("register_entry", {
    p_event_id: values.eventId,
    p_first_name: values.firstName,
    p_last_name: values.lastName,
    p_email: values.email,
    p_document_type: values.documentType,
    p_document_number: normalizedDocument,
    p_document_country: values.documentType === "passport" ? values.documentCountry : "ES",
  });
  if (error) return apiError(databaseMessage(error.message));

  const result = data?.[0] as { entry_id: string; assigned_number: number } | undefined;
  if (!result) return apiError("No s'ha pogut crear la participació", 500);
  const { data: event } = await supabase.from("events").select("*").eq("id", values.eventId).single();
  const { data: delivery } = await supabase.from("email_deliveries").insert({ entry_id: result.entry_id, recipient: values.email, status: "queued" }).select("id").single();

  let emailSent = false;
  try {
    const sent = await sendTicketEmail({ to: values.email, firstName: values.firstName, number: result.assigned_number, event: event as EventDay });
    emailSent = true;
    if (delivery) await supabase.from("email_deliveries").update({ status: "sent", provider_id: sent.messageId, updated_at: new Date().toISOString() }).eq("id", delivery.id);
  } catch (emailError) {
    if (delivery) await supabase.from("email_deliveries").update({ status: "failed", error: emailError instanceof Error ? emailError.message : "Error desconegut", updated_at: new Date().toISOString() }).eq("id", delivery.id);
  }

  await supabase.from("audit_logs").insert({ action: "entry.created", entity_type: "entry", entity_id: result.entry_id, payload: { event_id: values.eventId, number: result.assigned_number, email_sent: emailSent } });
  return NextResponse.json({ entryId: result.entry_id, number: result.assigned_number, emailSent });
}
