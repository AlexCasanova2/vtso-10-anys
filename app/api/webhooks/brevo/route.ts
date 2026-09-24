import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const statusMap: Record<string, string> = { delivered: "delivered", hard_bounce: "bounced", soft_bounce: "bounced", blocked: "bounced", error: "failed" };

export async function POST(request: Request) {
  const secret = process.env.BREVO_WEBHOOK_SECRET;
  if (secret && request.headers.get("x-webhook-secret") !== secret) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });
  const payload = await request.json().catch(() => null) as { event?: string; "message-id"?: string } | null;
  const status = payload?.event ? statusMap[payload.event] : undefined;
  const providerId = payload?.["message-id"];
  if (!status || !providerId) return NextResponse.json({ ok: true });
  await createAdminClient().from("email_deliveries").update({ status, updated_at: new Date().toISOString() }).eq("provider_id", providerId);
  return NextResponse.json({ ok: true });
}
