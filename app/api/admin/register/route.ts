import { NextResponse } from "next/server";
import { apiError, databaseMessage, requireApiAdmin } from "@/lib/api";
import { sendInvitationEmail } from "@/lib/brevo";
import { hashInvitationToken, invitationUrl, newInvitationToken } from "@/lib/invitation";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatDateTime } from "@/lib/types";
import { staffRegistrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const parsed = staffRegistrationSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");

  const values = parsed.data;
  const supabase = createAdminClient();
  const { data: event, error: eventError } = await supabase.from("events")
    .select("name").eq("id", values.eventId).maybeSingle();
  if (eventError || !event) return apiError("No s'ha trobat la jornada", 404);

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
