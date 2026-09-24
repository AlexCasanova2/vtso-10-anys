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

function AnimatedDraw({ number, position, total }: { number: number; position: number; total: number }) {
  const [displayedNumber, setDisplayedNumber] = useState(number);
  const [revealing, setRevealing] = useState(true);

  useEffect(() => {
    const roller = window.setInterval(() => setDisplayedNumber(Math.floor(Math.random() * 1000)), 70);
    const finish = window.setTimeout(() => {
      window.clearInterval(roller);
      setDisplayedNumber(number);
      setRevealing(false);
    }, 1800);
    return () => { window.clearInterval(roller); window.clearTimeout(finish); };
  }, [number]);

  return <div className={`draw-reveal ${revealing ? "is-revealing" : "is-revealed"}`}>
    <div className="draw-burst" aria-hidden="true">{Array.from({ length: 12 }, (_, index) => <i key={index} />)}</div>
    <span className="draw-progress">Número {position} de {total}</span>
    <strong aria-live="polite" aria-label={revealing ? "Extraient número" : `Número extret ${formatNumber(number)}`}>{formatNumber(displayedNumber)}</strong>
    <small>{revealing ? "La sort està girant" : "Número guanyador"}</small>
  </div>;
}

export function EventScreen({ displayMode = false, baseUrl }: { displayMode?: boolean; baseUrl: string }) {
  const event = useEvent();

  if (event === undefined) return <main className="event-shell loading">Preparant la celebració…</main>;
  if (!event) return <main className="event-shell empty"><Brand /><h1 className="display">Properament</h1><p>La pròxima jornada apareixerà aquí quan estigui configurada.</p><Link className="button" href="/admin">Administració</Link></main>;

  const open = new Date() >= new Date(event.registration_opens_at) && new Date() < new Date(event.registration_closes_at) && ["scheduled", "registration_open"].includes(event.status);
  const currentDraw = event.status === "drawing" ? event.current_draw : null;

  return (
    <main className={`event-shell ${displayMode ? "display-mode" : ""}`}>
      <div className="ambient-shapes" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="brand-triangle triangle-one" /><span className="brand-triangle triangle-two" /><span className="brand-triangle triangle-three" /><span className="giant-ten">10</span></div>
      <nav><Brand /><span className="anniversary">10 <small>ANYS</small></span></nav>
      <section className="event-hero">
        <div className="event-copy">
          <p className="eyebrow">Fem 10 anys</p>
          <h1 className="display">Regalem<br /><mark>10.000 €</mark></h1>
          <p className="event-message">{event.public_message || "40 premis de 250 €. Serà teu?"}</p>
          {currentDraw ? (
            <AnimatedDraw key={currentDraw.number} number={currentDraw.number} position={currentDraw.position} total={event.prize_count} />
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
