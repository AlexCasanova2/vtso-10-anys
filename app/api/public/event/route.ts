import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isPastEventDay, reconcileEventStatuses } from "@/lib/event-status";
import { getDrawState } from "@/lib/draw-sequence";
import type { EventDay } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    return await getEvent(request);
  } catch (error) {
    console.error("Public event API failed", error);
    return NextResponse.json({ error: "No s'ha pogut connectar amb la base de dades" }, { status: 500 });
  }
}

async function getEvent(request: Request) {
  const eventId = new URL(request.url).searchParams.get("id");
  await reconcileEventStatuses();
  const supabase = createAdminClient();
  const fields = "id,name,starts_at,registration_opens_at,registration_closes_at,prize_count,prize_value_cents,status,venue,club_signup_url,terms_url,privacy_url,public_message,draw_seed_commitment,draw_seed_revealed";

  if (eventId) {
    const { data, error } = await supabase.from("events").select(fields).eq("id", eventId).single();
    if (error) return NextResponse.json({ error: "No s'ha pogut carregar la jornada" }, { status: 500 });
    return eventResponse(supabase, data as EventDay);
  }

  const { data: candidates, error } = await supabase.from("events").select(fields).in("status", ["scheduled", "registration_open", "registration_closed", "drawing"]).order("starts_at", { ascending: true });
  if (error) return NextResponse.json({ error: "No s'ha pogut carregar la jornada" }, { status: 500 });
  const rawEvent = candidates?.find((event) => !isPastEventDay(event.starts_at));
  if (!rawEvent) return NextResponse.json({ event: null });

  return eventResponse(supabase, rawEvent as EventDay);
}

async function eventResponse(supabase: ReturnType<typeof createAdminClient>, rawEvent: EventDay) {
  const [entries, drawState] = await Promise.all([
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("event_id", rawEvent.id),
    getDrawState(supabase, rawEvent.id),
  ]);

  return NextResponse.json({ event: { ...rawEvent, participant_count: entries.count ?? 0, ...drawState } }, { headers: { "Cache-Control": "no-store" } });
}
