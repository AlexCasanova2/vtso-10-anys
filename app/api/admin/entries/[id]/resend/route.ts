import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { sendTicketEmail } from "@/lib/brevo";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventDay } from "@/lib/types";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("entries").select("id,number,email_snapshot,first_name_snapshot,events(*)").eq("id", id).single();
  if (!entry) return apiError("No s'ha trobat la participació", 404);
  const { data: delivery } = await supabase.from("email_deliveries").insert({ entry_id: id, recipient: entry.email_snapshot, status: "queued" }).select("id").single();
  try {
    const sent = await sendTicketEmail({ to: entry.email_snapshot, firstName: entry.first_name_snapshot, number: entry.number, event: entry.events as unknown as EventDay });
    await supabase.from("email_deliveries").update({ status: "sent", provider_id: sent.messageId, updated_at: new Date().toISOString() }).eq("id", delivery!.id);
    await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "entry.email_resent", entity_type: "entry", entity_id: id, payload: { recipient: entry.email_snapshot } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    await supabase.from("email_deliveries").update({ status: "failed", error: error instanceof Error ? error.message : "Error", updated_at: new Date().toISOString() }).eq("id", delivery!.id);
    return apiError("Brevo no ha pogut enviar el correu", 502);
  }
}
