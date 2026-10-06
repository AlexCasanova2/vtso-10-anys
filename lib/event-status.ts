import { createAdminClient } from "@/lib/supabase/admin";
import { ensureDrawSequence } from "@/lib/draw-sequence";
import { resolveEventStatus } from "@/lib/event-lifecycle";
export { isPastEventDay } from "@/lib/event-lifecycle";

export async function reconcileEventStatuses(now = new Date()) {
  const supabase = createAdminClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id,starts_at,registration_opens_at,registration_closes_at,status,assignment_seed,draw_seed,prize_count,updated_at")
    .not("status", "in", "(draft,completed)");

  if (error || !events) return;
  const nowIso = now.toISOString();

  await Promise.all(events.map(async (event) => {
    const nextStatus = resolveEventStatus(event, now);
    if (nextStatus !== event.status) {
      await supabase.from("events").update({
        status: nextStatus,
        ...(nextStatus === "completed" ? {
          assignment_seed_revealed: event.assignment_seed,
          draw_seed_revealed: event.draw_seed,
        } : {}),
        updated_at: nowIso,
      }).eq("id", event.id).eq("status", event.status);
    }

    if (event.status === "drawing") {
      await ensureDrawSequence(supabase, event);
    }
  }));
}
