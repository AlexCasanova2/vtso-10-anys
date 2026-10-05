import { NextResponse } from "next/server";
import { apiError, databaseMessage, requireApiAdmin } from "@/lib/api";
import { sendInvitationEmail } from "@/lib/brevo";
import { hashInvitationToken, invitationUrl, newInvitationToken } from "@/lib/invitation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/types";
import { fullStaffRegistrationSchema, staffRegistrationSchema } from "@/lib/validation";
import { sendRegistrationConfirmation } from "@/lib/registration-confirmation";

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => null);
  const parsed = staffRegistrationSchema.safeParse(body);
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");

  const values = parsed.data;
  const supabase = createAdminClient();
  const { data: event, error: eventError } = await supabase.from("events")
    .select("name,staff_registration_full").eq("id", values.eventId).maybeSingle();
  if (eventError || !event) return apiError("No s'ha trobat la jornada", 404);

  if (event.staff_registration_full) {
    const full = fullStaffRegistrationSchema.safeParse(body);
    if (!full.success) return apiError(full.error.issues[0]?.message ?? "Cal omplir totes les dades");
    const participant = full.data;
    const { data: entries, error } = await supabase.rpc("register_staff_ticket", {
      p_event_id: values.eventId, p_first_name: values.firstName, p_last_name: participant.lastName,
      p_email: values.email, p_document_type: participant.documentType,
      p_document_number: participant.documentNumber.toUpperCase().replace(/[^A-Z0-9]/g, ""),
      p_document_country: participant.documentType === "passport" ? participant.documentCountry : "ES",
      p_ticket_code: values.ticketCode, p_amount_cents: values.amountCents, p_actor_id: auth.user.id,
      p_club_member: participant.clubMember, p_legal_accepted: participant.legalAccepted,
    });
    if (error) return apiError(databaseMessage(error.message));
    const assigned = entries as { entry_id: string; assigned_number: number }[] | null;
    if (!assigned?.length) return apiError("No s'han pogut assignar els números", 500);
    const emailSent = await sendRegistrationConfirmation(assigned[0].entry_id, values.eventId, values.email, values.firstName);
    await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "ticket.registered", entity_type: "entry",
      entity_id: assigned[0].entry_id, payload: { event_id: values.eventId, numbers: assigned.map((entry) => entry.assigned_number), email_sent: emailSent } });
    return NextResponse.json({ pending: false, emailSent });
  }

  const token = newInvitationToken();
  let url: string;
  try {
    url = invitationUrl(token, process.env.REGISTRATION_BASE_URL);
  } catch (error) {
    console.error("No s'ha pogut configurar l'enllaç de participació", error);
    return apiError("No s'ha pogut preparar l'enllaç de participació", 500);
  }

  const { data, error } = await supabase.rpc("invite_ticket", {
    p_event_id: values.eventId,
    p_ticket_code: values.ticketCode,
    p_amount_cents: values.amountCents,
    p_first_name: values.firstName,
    p_email: values.email,
    p_token_hash: hashInvitationToken(token),
    p_actor_id: auth.user.id,
  });
  if (error) return apiError(databaseMessage(error.message));
  const invitation = (data as { pending_id: string; link_expires_at: string }[] | null)?.[0];
  if (!invitation) return apiError("No s'ha pogut preparar la invitació", 500);

  let emailSent = false;
  try {
    await sendInvitationEmail({ to: values.email, firstName: values.firstName, eventName: event.name,
      url, expiresAt: formatDateTime(invitation.link_expires_at) });
    emailSent = true;
    await supabase.from("pending_ticket_registrations")
      .update({ email_sent_at: new Date().toISOString() }).eq("id", invitation.pending_id);
  } catch (cause) {
    console.error("No s'ha pogut enviar l'enllaç de participació", cause);
  }

  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "ticket.invited",
    entity_type: "event", entity_id: values.eventId, payload: { pending_id: invitation.pending_id, email_sent: emailSent } });
  return NextResponse.json({ pending: true, emailSent });
}
