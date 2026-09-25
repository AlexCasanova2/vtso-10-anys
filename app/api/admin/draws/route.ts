import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiAdmin } from "@/lib/api";
import { getDrawHistory, revealNextDrawNumber } from "@/lib/draw-sequence";
import { createAdminClient } from "@/lib/supabase/admin";

const schema = z.object({ eventId: z.string().uuid(), action: z.enum(["extract", "redraw"]) });

export async function GET(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const eventId = z.string().uuid().safeParse(new URL(request.url).searchParams.get("eventId"));
  if (!eventId.success) return apiError("Jornada no vàlida");
  try {
    return NextResponse.json({ draws: await getDrawHistory(createAdminClient(), eventId.data) });
  } catch {
    return apiError("No s'ha pogut carregar l'històric", 500);
  }
}

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Operació no vàlida");
  const { eventId, action } = parsed.data;
  const result = await revealNextDrawNumber(eventId, auth.user.id, action);
  if (result.error) return result.error;
  return NextResponse.json({ draw: result.draw });
}
