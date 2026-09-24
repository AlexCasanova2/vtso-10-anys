"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, LoaderCircle, Mail, Ticket } from "lucide-react";
import { Brand } from "@/components/brand";
import { formatDateTime, formatNumber, type PublicEvent } from "@/lib/types";

type Result = { number: number; emailSent: boolean };

export function RegistrationForm({ eventId }: { eventId?: string }) {
  const [event, setEvent] = useState<PublicEvent | null>();
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [documentType, setDocumentType] = useState("dni");

  useEffect(() => {
    const url = eventId ? `/api/public/event?id=${eventId}` : "/api/public/event";
    fetch(url, { cache: "no-store" }).then((res) => res.json()).then((body) => setEvent(body.event)).catch(() => setEvent(null));
  }, [eventId]);

  async function submit(eventSubmit: FormEvent<HTMLFormElement>) {
    eventSubmit.preventDefault();
    if (!event) return;
    setSubmitting(true);
    setError("");
    const form = new FormData(eventSubmit.currentTarget);
    const payload = {
      eventId: event.id,
      firstName: form.get("firstName"), lastName: form.get("lastName"), email: form.get("email"),
      documentType: form.get("documentType"), documentNumber: form.get("documentNumber"),
      documentCountry: form.get("documentCountry") || "ES",
      clubMember: form.get("clubMember") === "on", legalAccepted: form.get("legalAccepted") === "on",
    };
    const response = await fetch("/api/register", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const body = await response.json();
    setSubmitting(false);
    if (!response.ok) return setError(body.error ?? "No s'ha pogut completar la inscripció");
    setResult(body);
  }

  if (event === undefined) return <main className="register-shell"><div className="register-loading"><LoaderCircle className="spin" /> Carregant la jornada…</div></main>;
  if (!event) return <main className="register-shell"><div className="register-panel card"><Brand /><h1 className="display">No hi ha cap jornada disponible</h1><Link href="/" className="button">Tornar</Link></div></main>;

  if (result) return (
    <main className="register-shell success-page">
      <section className="ticket-card">
        <div className="ticket-top"><Brand /><span className="ticket-icon"><Ticket /></span></div>
        <p className="eyebrow">Inscripció completada</p>
        <h1 className="display">Gràcies!</h1>
        <p className="success-lead">T&apos;has registrat correctament al sorteig.</p>
        <p className="ticket-number">{formatNumber(result.number)}</p>
        <p className="ticket-label">Aquest és el teu número de participació</p>
        <div className="ticket-details"><span>{event.name}</span><span>{formatDateTime(event.starts_at)}</span><span>{event.venue}</span></div>
        <div className={result.emailSent ? "success" : "error"}>{result.emailSent ? <><Mail size={17} /> Revisa la safata d&apos;entrada del teu correu electrònic. També et recomanem comprovar el correu brossa.</> : <>La teva participació és vàlida, però el correu no s&apos;ha pogut enviar. L&apos;equip el podrà reenviar.</>}</div>
        <p className="presence-note"><Check size={18} /> Si el teu número resulta premiat, hauràs de ser-hi per recollir-lo.</p>
        <Link href="/" className="button secondary"><ArrowLeft size={17} /> Tornar a l&apos;esdeveniment</Link>
      </section>
    </main>
  );

  const open = new Date() >= new Date(event.registration_opens_at) && new Date() < new Date(event.registration_closes_at) && ["scheduled", "registration_open"].includes(event.status);
  return (
    <main className="register-shell">
      <header className="register-header"><Brand /><Link href="/" className="back-link"><ArrowLeft size={16} /> Tornar</Link></header>
      <div className="register-grid">
        <section className="register-intro">
          <p className="eyebrow">10è aniversari</p>
          <h1 className="display">La teva oportunitat<br />comença aquí.</h1>
          <p>Omple les teves dades i rebràs un dels números disponibles per a <strong>{event.name}</strong>.</p>
          <dl><div><dt>Premis</dt><dd>{event.prize_count} × 250 €</dd></div><div><dt>Sorteig</dt><dd>{formatDateTime(event.starts_at)}</dd></div></dl>
        </section>
        <section className="register-panel card">
          <p className="eyebrow">Formulari de participació</p>
          {!open ? <div className="error">La inscripció per a aquesta jornada no està oberta.</div> : (
            <form onSubmit={submit}>
              <div className="form-row"><div className="field"><label htmlFor="firstName">Nom</label><input className="input" id="firstName" name="firstName" autoComplete="given-name" required /></div><div className="field"><label htmlFor="lastName">Cognoms</label><input className="input" id="lastName" name="lastName" autoComplete="family-name" required /></div></div>
              <div className="field"><label htmlFor="email">Correu electrònic</label><input className="input" id="email" name="email" type="email" autoComplete="email" placeholder="nom@exemple.cat" required /></div>
              <div className="form-row document-row"><div className="field"><label htmlFor="documentType">Document</label><select className="input" id="documentType" name="documentType" value={documentType} onChange={(e) => setDocumentType(e.target.value)}><option value="dni">DNI</option><option value="nie">NIE</option><option value="passport">Passaport</option></select></div><div className="field"><label htmlFor="documentNumber">Número</label><input className="input" id="documentNumber" name="documentNumber" autoCapitalize="characters" required /></div>{documentType === "passport" && <div className="field"><label htmlFor="documentCountry">País</label><input className="input" id="documentCountry" name="documentCountry" defaultValue="ES" maxLength={2} required /></div>}</div>
              <label className="check"><input type="checkbox" name="clubMember" required /><span>Soc membre del Club Style Outlets. <a href={event.club_signup_url} target="_blank" rel="noreferrer">Vull registrar-m&apos;hi</a>.</span></label>
              <label className="check"><input type="checkbox" name="legalAccepted" required /><span>He llegit i accepto les <a href={event.terms_url} target="_blank" rel="noreferrer">bases legals</a> i la <a href={event.privacy_url} target="_blank" rel="noreferrer">política de privacitat</a>.</span></label>
              {error && <div className="error" role="alert">{error}</div>}
              <button className="button yellow submit" disabled={submitting}>{submitting ? <><LoaderCircle className="spin" size={18} /> Assignant el número…</> : "Aconseguir el meu número"}</button>
            </form>
          )}
        </section>
      </div>
    </main>
  );
}
