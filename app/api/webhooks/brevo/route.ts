import { NextResponse } from "next/server";
import { deliveryReference } from "@/lib/email-tracking";
import { createAdminClient } from "@/lib/supabase/admin";

const statusMap: Record<string, string> = { delivered: "delivered", hard_bounce: "bounced", soft_bounce: "bounced", blocked: "bounced", error: "failed" };

export async function POST(request: Request) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { event?: string; "message-id"?: string; "X-Mailin-custom"?: string } | null;
  const status = payload?.event ? statusMap[payload.event] : undefined;
  const providerId = payload ? deliveryReference(payload) : null;
  if (!status || !providerId) return NextResponse.json({ ok: true });
  const { error } = await createAdminClient().from("email_deliveries").update({ status, updated_at: new Date().toISOString() }).eq("provider_id", providerId);
  if (error) return NextResponse.json({ error: "No s'ha pogut actualitzar l'estat del correu" }, { status: 500 });
  return NextResponse.json({ ok: true });
}
