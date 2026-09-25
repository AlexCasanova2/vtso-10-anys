import { createHmac } from "node:crypto";
import { apiError } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;
type DrawEvent = { id: string; draw_seed: string; prize_count: number; status: string; updated_at: string };
type PreparedPayload = { numbers: number[]; algorithm: string };
type RevealedPayload = { number: number; position: number };

function deterministicIndex(seed: string, context: string, upperBound: number) {
  const digest = createHmac("sha256", seed).update(context).digest();
  const limit = Math.floor(0x100000000 / upperBound) * upperBound;
  for (let offset = 0; offset < 32; offset += 4) {
    const value = digest.readUInt32BE(offset);
    if (value < limit) return value % upperBound;
  }
  return deterministicIndex(seed, `${context}:retry`, upperBound);
}

function generateNumbers(seed: string, assignedNumbers: number[]) {
  const pool = [...assignedNumbers].sort((a, b) => a - b);
  const selected: number[] = [];

  for (let position = 0; position < pool.length; position += 1) {
    const index = deterministicIndex(seed, `prize:${position + 1}`, pool.length);
    selected.push(pool.splice(index, 1)[0]);
  }

  return selected;
}

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

async function revealedNumbers(supabase: AdminClient, eventId: string) {
  const { data, error } = await supabase
    .from("audit_logs")
    .select("payload,created_at")
    .eq("entity_type", "event")
    .eq("entity_id", eventId)
    .eq("action", "draw.number_revealed")
    .order("created_at", { ascending: true }).range(0, 999);
  if (error) throw error;
  return (data ?? []).map((row) => ({ ...(row.payload as RevealedPayload), revealed_at: row.created_at }));
}

async function insertPreparedSequence(supabase: AdminClient, event: DrawEvent) {
  const numbers = generateNumbers(event.draw_seed, await assignedNumbers(supabase, event.id));
  if (!numbers.length) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("audit_logs").insert([
    { action: "draw.sequence_prepared", entity_type: "event", entity_id: event.id, payload: { numbers, algorithm: "hmac-sha256-registered-without-replacement-v2" }, created_at: now },
    { action: "draw.number_revealed", entity_type: "event", entity_id: event.id, payload: { number: numbers[0], position: 1 }, created_at: now },
  ]);
  if (error) console.error(`Draw sequence preparation failed for event ${event.id}`, error);
}

export async function ensureDrawSequence(supabase: AdminClient, event: DrawEvent, transitionOwned = false) {
  if (await preparedSequence(supabase, event.id)) return;

  if (!transitionOwned) {
    const now = new Date().toISOString();
    const { data: locked } = await supabase
      .from("events")
      .update({ updated_at: now })
      .eq("id", event.id)
      .eq("updated_at", event.updated_at)
      .select("id")
      .maybeSingle();
    if (!locked) return;
  }

  await insertPreparedSequence(supabase, event);
}

export async function getDrawState(supabase: AdminClient, eventId: string) {
  const [prepared, revealed] = await Promise.all([preparedSequence(supabase, eventId), revealedNumbers(supabase, eventId)]);
  if (!prepared) return { current_draw: null, revealed_count: 0 };
  const current = revealed.at(-1);
  return {
    current_draw: current ? { number: current.number, position: current.position, revealed_at: current.revealed_at } : null,
    revealed_count: current?.position ?? 0,
  };
}

export async function getDrawHistory(supabase: AdminClient, eventId: string) {
  const revealed = await revealedNumbers(supabase, eventId);
  return revealed.map((draw, index) => ({
    ...draw,
    status: (revealed[index + 1]?.position === draw.position ? "absent" : "awarded") as "absent" | "awarded",
  }));
}

export async function revealNextDrawNumber(eventId: string, actorId: string, action: "extract" | "redraw" = "extract") {
  const supabase = createAdminClient();
  const { data: event } = await supabase.from("events").select("id,status,updated_at,draw_seed,prize_count").eq("id", eventId).maybeSingle();
  if (!event || event.status !== "drawing") return { error: apiError("El sorteig no està actiu") };

  const [prepared, revealed] = await Promise.all([preparedSequence(supabase, eventId), revealedNumbers(supabase, eventId)]);
  if (!prepared) return { error: apiError("La seqüència del sorteig encara no està preparada") };
  const current = revealed.at(-1);
  if (!current) return { error: apiError("Encara no s'ha extret cap número") };
  if (action === "extract" && current.position >= event.prize_count) return { error: apiError("Ja s'han extret tots els números") };

  // Older events prepared a sequence from 000–999. For their remaining attempts,
  // generate an order using only assigned numbers rather than drawing empty tickets.
  const numbers = prepared.payload.algorithm === "hmac-sha256-registered-without-replacement-v2"
    ? prepared.payload.numbers
    : generateNumbers(event.draw_seed, await assignedNumbers(supabase, eventId));
  const used = new Set(revealed.map((draw) => draw.number));
  const number = numbers.find((candidate) => !used.has(candidate));
  if (number === undefined) return { error: apiError("No queden números de participants disponibles per sortejar") };

  const now = new Date().toISOString();
  const { data: locked } = await supabase
    .from("events")
    .update({ updated_at: now })
    .eq("id", eventId)
    .eq("updated_at", event.updated_at)
    .select("id")
    .maybeSingle();
  if (!locked) return { error: apiError("Ja hi ha una altra extracció en curs. Torna-ho a provar.", 409) };

  const position = action === "redraw" ? current.position : current.position + 1;
  const logs = action === "redraw" ? [
    { actor_id: actorId, action: "draw.number_absent", entity_type: "event", entity_id: eventId, payload: { number: current.number, position: current.position } },
  ] : [];
  logs.push({ actor_id: actorId, action: "draw.number_revealed", entity_type: "event", entity_id: eventId, payload: { number, position } });
  const { error } = await supabase.from("audit_logs").insert(logs);
  if (error) return { error: apiError("No s'ha pogut extreure el número", 500) };
  return { draw: { number, position } };
}
