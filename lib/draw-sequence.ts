import { apiError } from "@/lib/api";
import { generateNumbers, resolveDrawOrder } from "@/lib/draw-order";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveDrawHistory, type DrawAction, type DrawLog } from "@/lib/draw-history";

type AdminClient = ReturnType<typeof createAdminClient>;
type DrawEvent = { id: string; draw_seed: string };
type PreparedPayload = { numbers: number[]; algorithm: string };

async function assignedNumbers(supabase: AdminClient, eventId: string) {
  const { data, error } = await supabase.from("entries").select("number").eq("event_id", eventId).range(0, 999);
  if (error) throw error;
  return (data ?? []).map((entry) => entry.number);
}

async function preparedSequence(supabase: AdminClient, eventId: string) {
  const { data } = await supabase
    .from("audit_logs")
    .select("payload,created_at")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .eq("action", "draw.sequence_prepared")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? { payload: data.payload as PreparedPayload, createdAt: data.created_at } : null;
}

async function drawLogs(supabase: AdminClient, eventId: string) {
  const logs: DrawLog[] = [];
  for (let offset = 0; ; offset += 1000) {
    const { data, error } = await supabase
      .from("audit_logs")
      .select("action,payload,created_at")
      .eq("entity_type", "event")
      .eq("entity_id", eventId)
      .in("action", ["draw.number_revealed", "draw.number_absent", "draw.prize_unawarded"])
      .order("created_at", { ascending: true }).order("id", { ascending: true }).range(offset, offset + 999);
    if (error) throw error;
    logs.push(...(data ?? []) as unknown as DrawLog[]);
    if (!data || data.length < 1000) return logs;
  }
}

export async function ensureDrawSequence(supabase: AdminClient, event: DrawEvent) {
  const numbers = generateNumbers(event.draw_seed, await assignedNumbers(supabase, event.id));
  if (!numbers.length) return;
  const { error } = await supabase.rpc("prepare_draw_sequence", { p_event_id: event.id, p_numbers: numbers });
  if (error) throw new Error(`No s'ha pogut preparar la seqüència del sorteig: ${error.message}`);
}

export async function startDrawSequence(supabase: AdminClient, event: DrawEvent, actorId: string) {
  const numbers = generateNumbers(event.draw_seed, await assignedNumbers(supabase, event.id));
  return supabase.rpc("start_draw_event", { p_event_id: event.id, p_actor_id: actorId, p_numbers: numbers });
}

export async function getDrawState(supabase: AdminClient, eventId: string) {
  const [prepared, history] = await Promise.all([preparedSequence(supabase, eventId), getDrawHistory(supabase, eventId)]);
  if (!prepared) return { current_draw: null, revealed_count: 0 };
  const current = history.at(-1);
  return {
    current_draw: current ?? null,
    revealed_count: current?.position ?? 0,
  };
}

export async function getDrawHistory(supabase: AdminClient, eventId: string) {
  return resolveDrawHistory(await drawLogs(supabase, eventId));
}

export async function revealNextDrawNumber(eventId: string, actorId: string, action: DrawAction, expectedNumber: number) {
  const supabase = createAdminClient();
  const { data: event } = await supabase.from("events").select("id,status,updated_at,draw_seed,prize_count").eq("id", eventId).maybeSingle();
  if (!event || event.status !== "drawing") return { error: apiError("El sorteig no està actiu") };

  const prepared = await preparedSequence(supabase, eventId);
  if (!prepared) return { error: apiError("La seqüència del sorteig encara no està preparada") };

  // Reconstruir la secuencia en sorteos antiguos que incluían números vacíos
  // o cuya preparación quedó truncada, sin modificar su historial guardado.
  const numbers = resolveDrawOrder(event.draw_seed, await assignedNumbers(supabase, eventId), prepared.payload);
  const { data, error } = await supabase.rpc("advance_draw_event", {
    p_event_id: eventId, p_actor_id: actorId, p_action: action,
    p_expected_number: expectedNumber, p_numbers: numbers,
  });
  if (error) {
    const messages: Record<string, string> = {
      STALE_DRAW: "El número ha canviat. Actualitza el tauler abans de continuar.",
      ATTEMPT_LIMIT: "Aquest premi ja té dos intents. Si la persona no hi és, deixa'l sense adjudicar.",
      SKIP_NOT_ALLOWED: "Només es pot deixar sense adjudicar després del segon intent.",
      PRIZE_CLOSED: "Aquest premi ja està tancat. Actualitza el tauler.",
      DRAW_FINISHED: "Ja s'ha arribat a l'últim premi.",
      NO_ELIGIBLE_ENTRIES: "No queden números disponibles. Comprova l'històric abans de continuar.",
    };
    const reason = Object.keys(messages).find((key) => error.message.includes(key));
    if (!reason) console.error("No s'ha pogut avançar el sorteig", error);
    return { error: apiError(reason ? messages[reason] : "No s'ha pogut avançar el sorteig. Comprova l'històric abans de tornar-ho a provar", reason ? 409 : 500) };
  }
  return { draw: data };
}
