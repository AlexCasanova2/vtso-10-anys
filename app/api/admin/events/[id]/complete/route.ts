import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin("admin");
  if (auth.error) return auth.error;

  const { id } = await context.params;
  const supabase = createAdminClient();
  const { data: event, error: lookupError } = await supabase.from("events")
    .select("id,status,assignment_seed,draw_seed").eq("id", id).maybeSingle();
  if (lookupError) return apiError("No s'ha pogut carregar la jornada", 500);
  if (!event) return apiError("No s'ha trobat la jornada", 404);
  if (event.status !== "drawing") return apiError("Només es pot finalitzar un sorteig actiu", 409);

  const { data: completed, error } = await supabase.from("events").update({
    status: "completed",
    assignment_seed_revealed: event.assignment_seed,
    draw_seed_revealed: event.draw_seed,
    updated_at: new Date().toISOString(),
  }).eq("id", id).eq("status", "drawing").select("id").maybeSingle();
  if (error) return apiError("No s'ha pogut finalitzar el sorteig", 500);
  if (!completed) return apiError("El sorteig ja no està actiu", 409);

  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "draw.completed", entity_type: "event", entity_id: id, payload: {} });
  return NextResponse.json({ ok: true });
}
