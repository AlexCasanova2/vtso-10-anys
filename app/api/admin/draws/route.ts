import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, requireApiAdmin } from "@/lib/api";
import { revealNextDrawNumber } from "@/lib/draw-sequence";

const schema = z.object({ eventId: z.string().uuid(), action: z.literal("extract") });

export async function POST(request: Request) {
  const auth = await requireApiAdmin();
  if (auth.error) return auth.error;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return apiError("Operació no vàlida");
  const { eventId } = parsed.data;
  const result = await revealNextDrawNumber(eventId, auth.user.id);
  if (result.error) return result.error;
  return NextResponse.json({ draw: result.draw });
}
