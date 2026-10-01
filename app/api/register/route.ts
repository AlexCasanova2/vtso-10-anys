import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({ error: "La inscripció requereix validar el tiquet presencialment" }, { status: 403 });
}
