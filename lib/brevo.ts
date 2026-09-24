import { getServerEnv } from "@/lib/env";
import { formatDateTime, formatNumber, type EventDay } from "@/lib/types";

type TicketEmail = { to: string; firstName: string; number: number; event: EventDay };

export async function sendTicketEmail({ to, firstName, number, event }: TicketEmail) {
  const env = getServerEnv();
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) throw new Error("Brevo no està configurat");

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: to, name: firstName }],
      subject: `El teu número per a ${event.name}: ${formatNumber(number)}`,
      htmlContent: `<!doctype html><html lang="ca"><body style="margin:0;background:#f4f0e7;font-family:Arial,sans-serif;color:#11110f"><div style="max-width:560px;margin:auto;padding:32px 20px"><p style="font-size:12px;font-weight:bold;letter-spacing:2px">FEM 10 ANYS</p><div style="background:#ffd800;border:2px solid #11110f;border-radius:24px;padding:34px;text-align:center"><p>Hola, ${escapeHtml(firstName)}.</p><h1 style="font-size:72px;line-height:1;margin:24px 0">${formatNumber(number)}</h1><p style="font-weight:bold">Aquest és el teu número de participació</p></div><h2>${escapeHtml(event.name)}</h2><p>${formatDateTime(event.starts_at)} · ${escapeHtml(event.venue)}</p><p>Recorda que el lliurament del premi és presencial. Consulta la pantalla durant el sorteig per veure els números guanyadors.</p></div></body></html>`,
    }),
  });

  if (!response.ok) throw new Error(`Brevo ha respost amb ${response.status}`);
  return response.json() as Promise<{ messageId: string }>;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]!);
}
