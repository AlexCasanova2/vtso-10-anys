import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiAdmin } from "@/lib/api";
import { startDrawSequence } from "@/lib/draw-sequence";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return apiError("Jornada no vàlida");
  const supabase = createAdminClient();
  const { data: event, error: lookupError } = await supabase.from("events").select("id,draw_seed").eq("id", id).maybeSingle();
  if (lookupError) return apiError("No s'ha pogut carregar la jornada", 500);
  if (!event) return apiError("No s'ha trobat la jornada", 404);
  try {
    const { data, error } = await startDrawSequence(supabase, event, auth.user.id);
    if (error) {
      if (error.message.includes("DRAW_TOO_EARLY")) return apiError("Cal esperar l'hora prevista i el tancament de la inscripció", 409);
      if (error.message.includes("NO_ELIGIBLE_ENTRIES")) return apiError("No hi ha números confirmats per iniciar el sorteig", 409);
      if (error.message.includes("DRAW_NOT_STARTABLE")) return apiError("Aquesta jornada no es pot iniciar", 409);
      console.error("No s'ha pogut iniciar el sorteig", error);
      return apiError("No s'ha pogut iniciar el sorteig. Comprova l'estat abans de tornar-ho a provar", 500);
    }
    return NextResponse.json({ ok: true, started: data });
  } catch (error) {
    console.error("No s'ha pogut iniciar el sorteig", error);
    return apiError("No s'ha pogut iniciar el sorteig. Comprova l'estat abans de tornar-ho a provar", 500);
  }
}
