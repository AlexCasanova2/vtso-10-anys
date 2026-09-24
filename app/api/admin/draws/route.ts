import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, databaseMessage, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ eventId: z.string().uuid(), action: z.enum(["extract", "award", "absent"]) });

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Operació no vàlida");
  const { eventId, action } = parsed.data;
  const supabase = createAdminClient();

  if (action === "extract") {
    const { data, error } = await supabase.rpc("draw_next", { p_event_id: eventId, p_actor_id: auth.user.id });
    if (error) return apiError(databaseMessage(error.message));
    const draw = data?.[0];
    await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "draw.extracted", entity_type: "draw", entity_id: draw.draw_id, payload: draw });
    return NextResponse.json({ draw });
  }

  const { data: draw } = await supabase.from("draws").select("id,entry_id,prize_index,attempt").eq("event_id", eventId).eq("status", "pending").maybeSingle();
  if (!draw) return apiError("No hi ha cap extracció pendent");
  const status = action === "award" ? "awarded" : "absent";
  const { error } = await supabase.from("draws").update({ status, resolved_at: new Date().toISOString(), resolved_by: auth.user.id }).eq("id", draw.id).eq("status", "pending");
  if (error) return apiError("No s'ha pogut resoldre l'extracció", 500);
  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: `draw.${status}`, entity_type: "draw", entity_id: draw.id, payload: { event_id: eventId, prize_index: draw.prize_index, attempt: draw.attempt } });
  return NextResponse.json({ ok: true });
}
