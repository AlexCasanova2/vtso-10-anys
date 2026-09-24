import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { reconcileEventStatuses } from "@/lib/event-status";
import { eventSchema } from "@/lib/validation";

export async function GET() {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  await reconcileEventStatuses();
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("events").select("id,name,starts_at,registration_opens_at,registration_closes_at,prize_count,prize_value_cents,status,venue,club_signup_url,terms_url,privacy_url,public_message,draw_seed_commitment,draw_seed_revealed,entries(count),draws(count)").order("starts_at");
  if (error) return apiError("No s'han pogut carregar les jornades", 500);
  return NextResponse.json({ events: data });
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin("admin");
  if (auth.error) return auth.error;
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");
  const value = parsed.data;
  const assignmentSeed = randomBytes(32).toString("hex");
  const drawSeed = randomBytes(32).toString("hex");
  const supabase = createAdminClient();
  const { data, error } = await supabase.from("events").insert({
    name: value.name, starts_at: value.startsAt, registration_opens_at: value.registrationOpensAt,
    registration_closes_at: value.registrationClosesAt, prize_count: value.prizeCount,
    prize_value_cents: value.prizeValueCents, venue: value.venue, club_signup_url: value.clubSignupUrl,
    terms_url: value.termsUrl, privacy_url: value.privacyUrl, public_message: value.publicMessage, status: value.status,
    assignment_seed: assignmentSeed, assignment_seed_commitment: createHash("sha256").update(assignmentSeed).digest("hex"),
    draw_seed: drawSeed, draw_seed_commitment: createHash("sha256").update(drawSeed).digest("hex"),
  }).select("id").single();
  if (error) return apiError("No s'ha pogut crear la jornada", 500);
  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "event.created", entity_type: "event", entity_id: data.id, payload: value });
  return NextResponse.json({ id: data.id }, { status: 201 });
}
