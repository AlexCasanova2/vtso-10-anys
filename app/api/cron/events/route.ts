import { NextResponse } from "next/server";
import { reconcileEventStatuses } from "@/lib/event-status";

export async function GET(request: Request) {
  if (process.env.CRON_SECRET && request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: "No autoritzat" }, { status: 401 });
  await reconcileEventStatuses();
  return NextResponse.json({ ok: true });
}
