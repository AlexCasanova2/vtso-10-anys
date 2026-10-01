import { NextResponse } from "next/server";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";
import { eventSchema } from "@/lib/validation";

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin("admin");
  if (auth.error) return auth.error;
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError(parsed.error.issues[0]?.message ?? "Dades no vàlides");
  const { id } = await context.params;
  const value = parsed.data;
  const supabase = createAdminClient();
  const { data: existing, error: lookupError } = await supabase.from("events").select("status").eq("id", id).maybeSingle();
  if (lookupError) return apiError("No s'ha pogut carregar la jornada", 500);
  if (!existing) return apiError("No s'ha trobat la jornada", 404);
  if (value.status === "completed" && existing.status !== "completed") return apiError("Finalitza el sorteig des de l'operativa en directe");
  if (existing.status === "completed" && value.status !== "completed") return apiError("No es pot reobrir una jornada finalitzada");
  const { data: saved, error } = await supabase.from("events").update({
    name: value.name, starts_at: value.startsAt, registration_opens_at: value.registrationOpensAt,
    registration_closes_at: value.registrationClosesAt, prize_count: value.prizeCount,
    prize_value_cents: value.prizeValueCents, venue: value.venue, club_signup_url: value.clubSignupUrl,
    terms_url: value.termsUrl, privacy_url: value.privacyUrl, public_message: value.publicMessage,
    status: value.status, updated_at: new Date().toISOString(),
  }).eq("id", id).select("id,prize_count").maybeSingle();
  if (error) return apiError("No s'ha pogut desar la jornada", 500);
  if (!saved) return apiError("No s'ha trobat la jornada", 404);
  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "event.updated", entity_type: "event", entity_id: id, payload: value });
  return NextResponse.json({ id: saved.id, prizeCount: saved.prize_count });
}

export async function DELETE(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin("admin");
  if (auth.error) return auth.error;
  const { id } = await context.params;
  const supabase = createAdminClient();
  const [{ data: event }, entries] = await Promise.all([
    supabase.from("events").select("name").eq("id", id).maybeSingle(),
    supabase.from("entries").select("id", { count: "exact", head: true }).eq("event_id", id),
  ]);
  if (!event) return apiError("No s'ha trobat la jornada", 404);
  if ((entries.count ?? 0) > 0) return apiError("No es pot eliminar una jornada que ja té participacions. Finalitza-la per conservar-ne l'històric.", 409);

  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) return apiError("No s'ha pogut eliminar la jornada", 500);
  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "event.deleted", entity_type: "event", entity_id: id, payload: { name: event.name } });
  return NextResponse.json({ ok: true });
}
