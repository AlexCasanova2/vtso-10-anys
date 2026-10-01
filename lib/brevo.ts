import { getServerEnv } from "@/lib/env";
import { formatDateTime, type EventDay } from "@/lib/types";
import { renderTicketEmail } from "@/lib/ticket-email";

type TicketEmail = { to: string; firstName: string; numbers: number[]; event: EventDay };

export async function sendTicketEmail({ to, firstName, numbers, event }: TicketEmail) {
  const env = getServerEnv();
  if (!env.BREVO_API_KEY || !env.BREVO_SENDER_EMAIL) throw new Error("Brevo no està configurat");
  const content = renderTicketEmail({
    firstName, numbers, eventName: event.name, eventDate: formatDateTime(event.starts_at),
    venue: event.venue, termsUrl: event.terms_url, privacyUrl: event.privacy_url,
  });

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { name: env.BREVO_SENDER_NAME, email: env.BREVO_SENDER_EMAIL },
      to: [{ email: to, name: firstName }],
      subject: `Els teus números per a ${event.name}`,
      ...content,
    }),
  });

  if (!response.ok) throw new Error(`Brevo ha respost amb ${response.status}`);
  return response.json() as Promise<{ messageId: string }>;
}
