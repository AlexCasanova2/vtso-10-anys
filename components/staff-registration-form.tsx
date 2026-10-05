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
  const [documentType, setDocumentType] = useState("dni");
  const full = event.staff_registration_full ?? true;
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
      ...(full ? { lastName: form.get("lastName"), documentType: form.get("documentType"),
        documentNumber: form.get("documentNumber"), documentCountry: form.get("documentCountry") || "ES",
        clubMember: form.get("clubMember") === "on", legalAccepted: form.get("legalAccepted") === "on" } : {}),
    };
    try {
      const response = await fetch("/api/admin/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No s'ha pogut registrar el tiquet");
      setResult(body);
      if (body.emailSent || !body.pending) { formElement.reset(); setAmount(""); setDocumentType("dni"); }
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

  return <section className="staff-register card"><div><p className="eyebrow">Validació presencial</p><h2 className="display">{full ? "Registra una participació" : "Prepara una participació"}</h2><p>{full ? "Comprova el tiquet físic i el Club, completa les dades i recull l'acceptació de les bases. Els números s'assignen en confirmar."
    : "Comprova el tiquet físic (referència, import i data) i la pertinença al Club abans d'enviar l'enllaç. Encara no s'assignen números."}</p></div>
    {!open ? <p>La inscripció per a aquesta jornada no està oberta.</p> : <form onSubmit={submit}>
      <div className="field"><label>Referència del tiquet</label><input className="input" name="ticketCode" minLength={2} maxLength={100} required /></div>
      <div className="field"><label>Import comprovat (€)</label><input className="input" name="amount" type="number" min="60" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <strong className="staff-count">{numberCount} {numberCount === 1 ? "número" : "números"} · 60–79,99 €: 1 · 80–99,99 €: 2 · 100 € o més: 3</strong>
      <div className="field"><label>Nom</label><input className="input" name="firstName" required minLength={2} /></div>
      <div className="field"><label>Correu electrònic</label><input className="input" name="email" type="email" required /></div>
      {full && <>
        <div className="field"><label>Cognoms</label><input className="input" name="lastName" required minLength={2} maxLength={120} /></div>
        <div className="field"><label>Document</label><select className="input" name="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}><option value="dni">DNI</option><option value="nie">NIE</option><option value="passport">Passaport</option></select></div>
        <div className="field"><label>Número de document</label><input className="input" name="documentNumber" required maxLength={25} /></div>
        {documentType === "passport" && <div className="field"><label>País (dues lletres)</label><input className="input" name="documentCountry" defaultValue="ES" required minLength={2} maxLength={2} /></div>}
        <label className="check"><input type="checkbox" name="clubMember" required /> Participant membre del Club Style Outlets (comprovat presencialment)</label>
        <label className="check"><input type="checkbox" name="legalAccepted" required /> El participant ha acceptat les <a href={event.terms_url} target="_blank" rel="noreferrer">bases legals</a> i ha llegit la <a href={event.privacy_url} target="_blank" rel="noreferrer">política de privacitat</a></label>
      </>}
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button yellow" disabled={busy || numberCount === 0}>{busy ? <LoaderCircle className="spin" /> : <TicketCheck size={18} />} {full ? "Confirma la participació" : "Envia l'enllaç per completar la participació"}</button>
    </form>}
    {result && <p className="staff-result" role="status">{!result.pending
      ? result.emailSent ? "Participació confirmada. Correu amb els números enviat." : "Participació confirmada, però el correu ha fallat. Reenvia'l des de la llista de participacions; no tornis a registrar el tiquet."
      : result.emailSent
      ? "Enllaç enviat. La participació quedarà confirmada quan la persona completi les dades i accepti les bases."
      : "La sol·licitud està pendent, però no s'ha pogut enviar l'enllaç. Torna a desar aquest mateix tiquet per generar-ne un de nou."}</p>}
    {invitations.length > 0 && <div className="staff-pending"><h3>Invitacions pendents</h3>
      <p>Encara no participen en el sorteig. Reenviar un enllaç invalida l&apos;anterior.</p>
      {full && <p>Els enllaços enviats continuen sent vàlids. Per reenviar-los, desmarca el mode de registre complet a la configuració de la jornada.</p>}
      <ul>{invitations.map((invitation) => <li key={invitation.id}>
        <span><strong>{invitation.first_name}</strong> · {invitation.ticket_code} · {invitation.email}
          <small>{new Date(invitation.expires_at) <= new Date() ? " Enllaç caducat" : invitation.email_sent_at ? " Enllaç enviat" : " Enviament pendent"}</small></span>
        <button className="button secondary small" type="button" disabled={busy || !open || full}
          onClick={() => resend(invitation)}>Reenvia l&apos;enllaç</button>
      </li>)}</ul>
    </div>}
  </section>;
}
