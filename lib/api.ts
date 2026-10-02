import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/auth";

export function apiError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function requireApiAdmin(requiredRole?: "admin") {
  const user = await getAdmin();
  if (!user) return { error: apiError("No autoritzat", 401), user: null };
  if (requiredRole && user.role !== requiredRole) return { error: apiError("Permisos insuficients", 403), user: null };
  return { error: null, user };
}

export function databaseMessage(message: string) {
  if (message.includes("ALREADY_REGISTERED")) return "Ja tens una participació per a aquesta jornada";
  if (message.includes("REGISTRATION_NOT_OPEN")) return "La inscripció encara no està oberta";
  if (message.includes("REGISTRATION_CLOSED")) return "La inscripció per a aquesta jornada està tancada";
  if (message.includes("EVENT_FULL")) return "S'han assignat els 1.000 números disponibles";
  if (message.includes("TICKET_ALREADY_USED")) return "Aquest tiquet ja s'ha registrat en aquesta jornada";
  if (message.includes("LINK_EXPIRED")) return "L'enllaç ha caducat. Demana al personal que te n'enviï un altre";
  if (message.includes("INVALID_LINK")) return "Aquest enllaç no és vàlid o ja s'ha utilitzat";
  if (message.includes("DOCUMENT_EMAIL_MISMATCH")) return "Aquest document ja està associat a un altre correu. Consulta-ho amb el personal";
  if (message.includes("AMOUNT_TOO_LOW")) return "El tiquet ha de ser d'almenys 60 €";
  if (message.includes("INVALID_TICKET")) return "Introdueix una referència de tiquet vàlida";
  if (message.includes("PENDING_DRAW")) return "Has de resoldre l'extracció actual abans de continuar";
  if (message.includes("ALL_PRIZES_AWARDED")) return "Ja s'han lliurat tots els premis d'aquesta jornada";
  if (message.includes("NO_ELIGIBLE_ENTRIES")) return "No queden participacions disponibles";
  if (message.includes("DRAW_NOT_OPEN")) return "La jornada no està en mode sorteig";
  return "No s'ha pogut completar l'operació";
}
