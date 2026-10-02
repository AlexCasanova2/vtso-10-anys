"use client";

import { type FormEvent, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { formatNumber } from "@/lib/types";

export function RegistrationCompletionForm({ token, firstName, termsUrl, privacyUrl }: {
  token: string; firstName: string; termsUrl: string; privacyUrl: string;
}) {
  const [documentType, setDocumentType] = useState("dni");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ numbers: number[]; emailSent: boolean } | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    const form = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/registration/complete", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, lastName: form.get("lastName"), documentType: form.get("documentType"),
          documentNumber: form.get("documentNumber"), documentCountry: form.get("documentCountry") || "ES",
          legalAccepted: form.get("legalAccepted") === "on" }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No s'ha pogut completar la participació");
      setResult(body);
    } catch (cause) { setError((cause as Error).message); }
    finally { setBusy(false); }
  }

  return <section className="register-panel card">
    {result ? <div role="status"><h2>Participació confirmada</h2>
      <p>Els teus números són <strong>{result.numbers.map(formatNumber).join(" · ")}</strong>.</p>
      <p>{result.emailSent ? "T'hem enviat un correu amb tots els números de la jornada."
        : "La participació és vàlida, però no s'ha pogut enviar el correu. Demana al personal que el reenviï."}</p>
    </div> : <><h2>Les teves dades</h2><p>Hola, {firstName}. Completa la informació per confirmar la participació.</p>
      <form onSubmit={submit}>
        <div className="field"><label htmlFor="completion-last-name">Cognoms</label>
          <input className="input" id="completion-last-name" name="lastName" required minLength={2} maxLength={120} /></div>
        <div className="form-row document-row">
          <div className="field"><label htmlFor="completion-document-type">Document</label>
            <select className="input" id="completion-document-type" name="documentType" value={documentType}
              onChange={(event) => setDocumentType(event.target.value)}>
              <option value="dni">DNI</option><option value="nie">NIE</option><option value="passport">Passaport</option>
            </select></div>
          <div className="field"><label htmlFor="completion-document-number">Número de document</label>
            <input className="input" id="completion-document-number" name="documentNumber" required /></div>
          {documentType === "passport" && <div className="field"><label htmlFor="completion-country">País</label>
            <input className="input" id="completion-country" name="documentCountry" defaultValue="ES"
              minLength={2} maxLength={2} required /></div>}
        </div>
        <p>La pertinença al Club ja s&apos;ha comprovat presencialment.</p>
        <label className="check"><input type="checkbox" name="legalAccepted" required />
          <span>Accepto les <a href={termsUrl} target="_blank" rel="noreferrer">bases legals</a> i he llegit la <a href={privacyUrl} target="_blank" rel="noreferrer">política de privacitat</a>.</span>
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="button yellow submit" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : "Confirma la participació"}</button>
      </form></>}
  </section>;
}
