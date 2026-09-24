"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QRCodeSVG } from "qrcode.react";
import { ArrowRight, Users } from "lucide-react";
import type { PublicEvent } from "@/lib/types";
import { formatNumber } from "@/lib/types";
import { Brand } from "@/components/brand";

function useEvent() {
  const [event, setEvent] = useState<PublicEvent | null>();
  useEffect(() => {
    let active = true;
    const load = () => fetch("/api/public/event", { cache: "no-store" }).then((res) => res.json()).then((body) => active && setEvent(body.event)).catch(() => active && setEvent(null));
    load();
    const timer = window.setInterval(load, 3000);
    return () => { active = false; window.clearInterval(timer); };
  }, []);
  return event;
}

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, new Date(target).getTime() - now);
  const parts = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  return <div className="countdown">{parts.map((part, index) => <div key={index}><strong>{String(part).padStart(2, "0")}</strong><span>{["dies", "hores", "min", "seg"][index]}</span></div>)}</div>;
}

export function EventScreen({ displayMode = false, baseUrl }: { displayMode?: boolean; baseUrl: string }) {
  const event = useEvent();

  if (event === undefined) return <main className="event-shell loading">Preparant la celebració…</main>;
  if (!event) return <main className="event-shell empty"><Brand /><h1 className="display">Properament</h1><p>La pròxima jornada apareixerà aquí quan estigui configurada.</p><Link className="button" href="/admin">Administració</Link></main>;

  const open = new Date() >= new Date(event.registration_opens_at) && new Date() < new Date(event.registration_closes_at) && ["scheduled", "registration_open"].includes(event.status);
  const liveNumber = event.pending_draw?.number ?? event.last_awarded?.number;
  const drawing = event.status === "drawing" && liveNumber !== undefined;

  return (
    <main className={`event-shell ${displayMode ? "display-mode" : ""}`}>
      <div className="ambient-shapes" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="brand-triangle triangle-one" /><span className="brand-triangle triangle-two" /><span className="brand-triangle triangle-three" /><span className="giant-ten">10</span></div>
      <nav><Brand /><span className="anniversary">10 <small>ANYS</small></span></nav>
      <section className="event-hero">
        <div className="event-copy">
          <p className="eyebrow">Fem 10 anys</p>
          <h1 className="display">Regalem<br /><mark>10.000 €</mark></h1>
          <p className="event-message">{event.public_message || "40 premis de 250 €. Serà teu?"}</p>
          {drawing ? (
            <div className="winner-callout"><span>{event.pending_draw ? "Número extret" : "Últim guanyador"}</span><strong>{formatNumber(liveNumber)}</strong>{event.pending_draw && <small>Comprovant la presència</small>}</div>
          ) : (
            <><p className="eyebrow countdown-title">El sorteig comença d&apos;aquí a</p><Countdown target={event.starts_at} /></>
          )}
        </div>
        <aside className="join-card">
          <div className="qr-wrap">{baseUrl && <QRCodeSVG value={`${baseUrl}/registro?jornada=${event.id}`} size={190} level="M" />}</div>
          <h2 className="display">Escaneja.<br />Inscriu-t&apos;hi.<br />Participa.</h2>
          <div className="participant-stat"><Users size={22} /><strong>{event.participant_count}</strong><span>participants avui</span></div>
          {!displayMode && open && <Link className="button yellow" href={`/registro?jornada=${event.id}`}>Aconsegueix el teu número <ArrowRight size={18} /></Link>}
          {!open && <p className="closed-note">La inscripció està tancada en aquest moment.</p>}
        </aside>
      </section>
      <div className="event-ticker" aria-hidden="true"><div className="ticker-track"><div className="ticker-group"><span>40 PREMIS DE 250 €</span><i>◆</i><span>10 ANYS JUNTS</span><i>◆</i><span>10.000 € EN PREMIS</span><i>◆</i></div><div className="ticker-group"><span>40 PREMIS DE 250 €</span><i>◆</i><span>10 ANYS JUNTS</span><i>◆</i><span>10.000 € EN PREMIS</span><i>◆</i></div></div></div>
      <footer><span>{event.name}</span><span>{event.venue}</span></footer>
    </main>
  );
}
