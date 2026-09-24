import { createAdminClient } from "@/lib/supabase/admin";

const dateKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date(value));

export function isPastEventDay(startsAt: string, now = new Date()) {
  return dateKey(startsAt) < dateKey(now);
}

export async function reconcileEventStatuses(now = new Date()) {
  const supabase = createAdminClient();
  const { data: events, error } = await supabase
    .from("events")
    .select("id,starts_at,registration_opens_at,registration_closes_at,status,assignment_seed,draw_seed")
    .not("status", "in", "(draft,completed)");

  if (error || !events) return;
  const nowIso = now.toISOString();

  await Promise.all(events.map(async (event) => {
    if (isPastEventDay(event.starts_at, now) && event.status !== "drawing") {
      await supabase.from("events").update({
        status: "completed",
        assignment_seed_revealed: event.assignment_seed,
        draw_seed_revealed: event.draw_seed,
        updated_at: nowIso,
      }).eq("id", event.id);
      return;
    }

    if (nowIso >= event.starts_at && ["scheduled", "registration_open", "registration_closed"].includes(event.status)) {
      const { data: started, error: startError } = await supabase
        .from("events")
        .update({ status: "drawing", updated_at: nowIso })
        .eq("id", event.id)
        .eq("status", event.status)
        .select("id")
        .maybeSingle();

      if (startError || !started) return;

      const { error: drawError } = await supabase.rpc("draw_next", { p_event_id: event.id, p_actor_id: null });
      if (drawError && !drawError.message.includes("NO_ELIGIBLE_ENTRIES")) {
        console.error(`Automatic first draw failed for event ${event.id}`, drawError);
      }
      return;
    }

    if (nowIso >= event.registration_closes_at && ["scheduled", "registration_open"].includes(event.status)) {
      await supabase.from("events").update({ status: "registration_closed", updated_at: nowIso }).eq("id", event.id);
      return;
    }

    if (nowIso >= event.registration_opens_at && nowIso < event.registration_closes_at && event.status === "scheduled") {
      await supabase.from("events").update({ status: "registration_open", updated_at: nowIso }).eq("id", event.id);
    }
  }));
}
