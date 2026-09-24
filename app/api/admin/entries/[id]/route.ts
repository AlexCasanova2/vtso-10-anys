import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiAdmin } from "@/lib/api";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ email: z.string().trim().email().max(180) });

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("El correu electrònic no és vàlid");
  const { id } = await context.params;
  const email = parsed.data.email.toLowerCase();
  const supabase = createAdminClient();
  const { data: entry } = await supabase.from("entries").select("participant_id,email_snapshot").eq("id", id).single();
  if (!entry) return apiError("No s'ha trobat la participació", 404);
  const { error } = await supabase.from("participants").update({ email, updated_at: new Date().toISOString() }).eq("id", entry.participant_id);
  if (error) return apiError("No s'ha pogut actualitzar el correu", 500);
  await supabase.from("entries").update({ email_snapshot: email }).eq("id", id);
  await supabase.from("audit_logs").insert({ actor_id: auth.user.id, action: "entry.email_updated", entity_type: "entry", entity_id: id, payload: { before: entry.email_snapshot, after: email } });
  return NextResponse.json({ ok: true });
}
