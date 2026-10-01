"use client";

import { FormEvent, useState } from "react";
import { LoaderCircle, TicketCheck } from "lucide-react";
import { formatNumber, type EventDay } from "@/lib/types";
import { ticketNumberCount } from "@/lib/ticket-tiers";

type Result = { numbers: number[]; emailSent: boolean };

export function StaffRegistrationForm({ event, onRegistered }: { event: EventDay; onRegistered: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [documentType, setDocumentType] = useState("dni");
  const [amount, setAmount] = useState("");
  const open = new Date() >= new Date(event.registration_opens_at) && new Date() < new Date(event.registration_closes_at) && ["scheduled", "registration_open"].includes(event.status);
  const amountCents = Math.round(Number(amount) * 100);
  const numberCount = ticketNumberCount(amountCents);

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    if (!open || !numberCount) return;
    setBusy(true); setError(""); setResult(null);
    const formElement = submitEvent.currentTarget;
    const form = new FormData(formElement);
    const payload = {
      eventId: event.id, firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"),
      documentType: form.get("documentType"), documentNumber: form.get("documentNumber"), documentCountry: form.get("documentCountry") || "ES",
      ticketCode: form.get("ticketCode"), amountCents,
      clubMember: form.get("clubMember") === "on", legalAccepted: form.get("legalAccepted") === "on",
    };
    try {
      const response = await fetch("/api/admin/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No s'ha pogut registrar el tiquet");
      setResult(body); formElement.reset(); setAmount(""); setDocumentType("dni"); onRegistered();
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="staff-register card"><div><p className="eyebrow">Validació presencial</p><h2 className="display">Registra un tiquet</h2><p>Comprova el tiquet físic i la seva referència abans d&apos;assignar els números.</p></div>
    {!open ? <p>La inscripció per a aquesta jornada no està oberta.</p> : <form onSubmit={submit}>
      <div className="field"><label>Referència del tiquet</label><input className="input" name="ticketCode" minLength={2} maxLength={100} required /></div>
      <div className="field"><label>Import comprovat (€)</label><input className="input" name="amount" type="number" min="60" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required /></div>
      <strong className="staff-count">{numberCount} {numberCount === 1 ? "número" : "números"} · 60–79,99 €: 1 · 80–99,99 €: 2 · 100 € o més: 3</strong>
      <div className="field"><label>Nom</label><input className="input" name="firstName" required minLength={2} /></div>
      <div className="field"><label>Cognoms</label><input className="input" name="lastName" required minLength={2} /></div>
      <div className="field"><label>Correu electrònic</label><input className="input" name="email" type="email" required /></div>
      <div className="field"><label>Document</label><select className="input" name="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}><option value="dni">DNI</option><option value="nie">NIE</option><option value="passport">Passaport</option></select></div>
      <div className="field"><label>Número de document</label><input className="input" name="documentNumber" required /></div>
      {documentType === "passport" && <div className="field"><label>País (codi de dues lletres)</label><input className="input" name="documentCountry" defaultValue="ES" minLength={2} maxLength={2} required /></div>}
      <label className="check"><input type="checkbox" name="clubMember" required /> Participant membre del Club Style Outlets (comprovat)</label>
      <label className="check"><input type="checkbox" name="legalAccepted" required /> El participant ha acceptat les <a href={event.terms_url} target="_blank" rel="noreferrer">bases legals</a> i la <a href={event.privacy_url} target="_blank" rel="noreferrer">política de privacitat</a></label>
      {error && <p className="error" role="alert">{error}</p>}
      <button className="button yellow" disabled={busy || numberCount === 0}>{busy ? <LoaderCircle className="spin" /> : <TicketCheck size={18} />} Assigna {numberCount} {numberCount === 1 ? "número" : "números"}</button>
    </form>}
    {result && <p className="staff-result" role="status">Números assignats: <strong>{result.numbers.map(formatNumber).join(" · ")}</strong>. {result.emailSent ? "Correu enviat." : "No s'ha pogut enviar el correu; les participacions són vàlides i es poden reenviar."}</p>}
  </section>;
}
