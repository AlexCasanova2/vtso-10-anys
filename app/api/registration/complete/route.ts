import { NextResponse } from "next/server";
import { apiError, databaseMessage } from "@/lib/api";
import { sendRegistrationConfirmation } from "@/lib/registration-confirmation";
import { hashInvitationToken } from "@/lib/invitation";
import { createAdminClient } from "@/lib/supabase/admin";
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
  const emailSent = await sendRegistrationConfirmation(first.entry_id, first.event_id, first.recipient, first.first_name);

  await supabase.from("audit_logs").insert({ action: "ticket.registered", entity_type: "entry",
    entity_id: first.entry_id, payload: { event_id: first.event_id, numbers, email_sent: emailSent } });
  return NextResponse.json({ emailSent });
}
