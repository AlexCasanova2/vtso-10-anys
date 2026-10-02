"use client";

import { FormEvent, useEffect, useState } from "react";
import { LoaderCircle, TicketCheck } from "lucide-react";
import type { EventDay } from "@/lib/types";
import { ticketNumberCount } from "@/lib/ticket-tiers";
import { isRegistrationOpen } from "@/lib/registration-window";

type Result = { pending: boolean; emailSent: boolean };
type PendingInvitation = { id: string; ticket_code: string; amount_cents: number; first_name: string;
  email: string; email_sent_at: string | null; expires_at: string };

export function StaffRegistrationForm({ event, onRegistered }: { event: EventDay; onRegistered: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [invitations, setInvitations] = useState<PendingInvitation[]>([]);
  const [refresh, setRefresh] = useState(0);
  const [amount, setAmount] = useState("");
  const open = isRegistrationOpen(event);
  const amountCents = Math.round(Number(amount) * 100);
  const numberCount = ticketNumberCount(amountCents);

  useEffect(() => {
    let active = true;
    fetch(`/api/admin/pending?eventId=${event.id}`)
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((body) => { if (active) setInvitations(body.invitations); })
      .catch(() => { if (active) setInvitations([]); });
    return () => { active = false; };
  }, [event.id, refresh]);

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!open || !numberCount) return;
    setBusy(true); setError(""); setResult(null);
    const formElement = submitEvent.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      eventId: event.id, firstName: form.get("firstName"), email: form.get("email"),
      ticketCode: form.get("ticketCode"), amountCents,
    };
    try {
      const response = await fetch("/api/admin/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No s'ha pogut registrar el tiquet");
      setResult(body);
      if (body.emailSent) { formElement.reset(); setAmount(""); }
      setRefresh((value) => value + 1);
      onRegistered();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  async function resend(invitation: PendingInvitation) {
    setBusy(true); setError(""); setResult(null);
    try {
      const response = await fetch("/api/admin/register", { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ eventId: event.id, ticketCode: invitation.ticket_code,
          amountCents: invitation.amount_cents, firstName: invitation.first_name, email: invitation.email }) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No s'ha pogut reenviar l'enllaç");
      setResult(body); setRefresh((value) => value + 1);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="staff-register card"><div><p className="eyebrow">Validació presencial</p><h2 className="display">Prepara una participació</h2><p>Comprova el tiquet físic (referència, import i data) i la pertinença al Club abans d&apos;enviar l&apos;enllaç. Encara no s&apos;assignen números.</p></div>
    {!open ? <p>La inscripció per a aquesta jornada no està oberta.</p> : <form onSubmit={submit}>
      <div className="field"><label>Referència del tiquet</label><input className="input" name="ticketCode" minLength={2} maxLength={100} required /></div>
      <div className="field"><label>Import comprovat (€)</label><input className="input" name="amount" type="number" min="60" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <strong className="staff-count">{numberCount} {numberCount === 1 ? "número" : "números"} · 60–79,99 €: 1 · 80–99,99 €: 2 · 100 € o més: 3</strong>
      <div className="field"><label>Nom</label><input className="input" name="firstName" required minLength={2} /></div>
      <div className="field"><label>Correu electrònic</label><input className="input" name="email" type="email" required /></div>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button yellow" disabled={busy || numberCount === 0}>{busy ? <LoaderCircle className="spin" /> : <TicketCheck size={18} />} Envia l&apos;enllaç per completar la participació</button>
    </form>}
    {result && <p className="staff-result" role="status">{result.emailSent
      ? "Enllaç enviat. La participació quedarà confirmada quan la persona completi les dades i accepti les bases."
      : "La sol·licitud està pendent, però no s'ha pogut enviar l'enllaç. Torna a desar aquest mateix tiquet per generar-ne un de nou."}</p>}
    {invitations.length > 0 && <div className="staff-pending"><h3>Invitacions pendents</h3>
      <p>Encara no participen en el sorteig. Reenviar un enllaç invalida l&apos;anterior.</p>
      <ul>{invitations.map((invitation) => <li key={invitation.id}>
        <span><strong>{invitation.first_name}</strong> · {invitation.ticket_code} · {invitation.email}
          <small>{new Date(invitation.expires_at) <= new Date() ? " Enllaç caducat" : invitation.email_sent_at ? " Enllaç enviat" : " Enviament pendent"}</small></span>
        <button className="button secondary small" type="button" disabled={busy || !open}
          onClick={() => resend(invitation)}>Reenvia l&apos;enllaç</button>
      </li>)}</ul>
    </div>}
  </section>;
}
