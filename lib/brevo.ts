import nodemailer from "nodemailer";
import { getServerEnv } from "@/lib/env";
import { emailTrackingHeader } from "@/lib/email-tracking";
import { formatDateTime, type EventDay } from "@/lib/types";
import { renderTicketEmail } from "@/lib/ticket-email";

type TicketEmail = { to: string; firstName: string; numbers: number[]; event: EventDay; trackingId: string };

export async function sendTicketEmail({ to, firstName, numbers, event, trackingId }: TicketEmail) {
  const env = getServerEnv();
  if (!env.BREVO_SMTP_LOGIN || !env.BREVO_SMTP_KEY || !env.BREVO_SENDER_EMAIL) throw new Error("El SMTP de Brevo no està configurat");
  const content = renderTicketEmail({
    firstName, numbers, eventName: event.name, eventDate: formatDateTime(event.starts_at),
    venue: event.venue, termsUrl: event.terms_url, privacyUrl: event.privacy_url,
  });

  const transporter = nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    requireTLS: true,
    auth: { user: env.BREVO_SMTP_LOGIN, pass: env.BREVO_SMTP_KEY },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
  });
  const sent = await transporter.sendMail({
    from: { name: env.BREVO_SENDER_NAME, address: env.BREVO_SENDER_EMAIL },
    to: [{ name: firstName, address: to }],
    subject: `Els teus números per a ${event.name}`,
    html: content.htmlContent,
    text: content.textContent,
    headers: { "X-Mailin-custom": emailTrackingHeader(trackingId) },
  });
  if (!sent.accepted.some((address) => address.toLowerCase() === to.toLowerCase())) {
    throw new Error("El servidor SMTP no ha acceptat el destinatari");
  }
}
