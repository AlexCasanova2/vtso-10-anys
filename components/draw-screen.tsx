"use client";

import { useEffect, useState } from "react";
import { Brand } from "@/components/brand";
import { usePublicEvent } from "@/components/use-public-event";
import { formatMoney, formatNumber, type PublicEvent } from "@/lib/types";

function Revelation({ draw, total }: { draw: NonNullable<PublicEvent["current_draw"]>; total: number }) {
  const [elapsed, setElapsed] = useState(0);
  const [digits, setDigits] = useState("000");
  useEffect(() => {
    const start = performance.now();
    const timer = setInterval(() => {
      const time = performance.now() - start;
      setElapsed(time);
      setDigits(formatNumber(Math.floor(Math.random() * 1000)));
      if (time >= 4800) clearInterval(timer);
    }, 65);
    return () => clearInterval(timer);
  }, []);
  const finished = elapsed >= 4800;
  const winner = formatNumber(draw.number);
  return <section className={`show-revelation ${finished ? "landed" : "rolling"}`}>
    <p className="show-kicker">EXTRACCIÓ {String(draw.position).padStart(2, "0")} <span>/ {String(total).padStart(2, "0")}</span></p>
    <h1 className="show-label">{finished ? "El número guanyador és" : "La teva sort, a punt de sortir"}</h1>
    <div className="show-digits" aria-hidden="true">{winner.split("").map((digit, index) => {
      const settled = elapsed >= 3000 + index * 900;
      return <span key={index} className={settled ? "settled" : "spinning"}>{settled ? digit : digits[index]}</span>;
    })}</div>
    <p className="show-result" role="status">{finished ? `Número guanyador ${winner}` : "Extraient número…"}</p>
    <div className="show-wait">{finished ? (draw.position === total ? "Tots els números revelats · Gràcies per celebrar-ho amb nosaltres" : "Celebrem aquest premi. El següent, en uns instants.") : "000 — 999 · Mil números, un moment únic"}</div>
    {finished && <div className="show-confetti" aria-hidden="true">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ left: `${(i * 43) % 100}%`, animationDelay: `${i * .035}s`, background: ["#ffed00", "#e75294", "#00b1cd", "#7baf1f"][i % 4] }} />)}</div>}
  </section>;
}

function Show({ event }: { event: PublicEvent }) {
  const [introDone, setIntroDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIntroDone(true), 5500);
    return () => clearTimeout(timer);
  }, []);
  const ready = introDone && event.current_draw;
  return <main className={`draw-show ${ready ? "on-air" : "opening"}`}>
    <div className="show-scenery" aria-hidden="true"><div className="show-halo" /><div className="show-orbit" /><i className="vtso-triangle triangle-cyan" /><i className="vtso-triangle triangle-pink" /><i className="vtso-triangle triangle-green" /><span className="show-ten">10</span><div className="show-grain" /></div>
    <header className="show-header"><Brand /><span className="show-live"><i /> SORTEIG EN DIRECTE</span><span className="show-anniversary">10 <small>ANYS JUNTS</small></span></header>
    <div className="show-stage">
      {ready ? <Revelation key={`${event.id}:${ready.revealed_at}:${ready.number}`} draw={ready} total={event.prize_count} /> : <section className="show-intro"><p className="show-kicker">VILADECANS THE STYLE OUTLETS</p><h1>El teu moment<br /><em>està a punt.</em></h1><p className="show-intro-copy">En breus començarà el sorteig</p><div className="show-loading"><span /></div><small>Prepara el teu número. Comença l&apos;emoció.</small></section>}
    </div>
    <footer className="show-footer"><div><strong>{event.participant_count}</strong><span>participants</span></div><div><strong>{event.prize_count}</strong><span>números guanyadors</span></div><div><strong>{formatMoney(event.prize_value_cents)}</strong><span>per premi</span></div><p>{event.name}<span>{event.venue}</span></p></footer>
  </main>;
}

export function DrawScreen({ eventId }: { eventId?: string }) {
  const event = usePublicEvent(eventId);
  if (!event) return <main className="draw-show show-placeholder"><Brand /><h1>{event === null ? "El pròxim gran moment, ben aviat." : "Preparant el teu moment…"}</h1></main>;
  return <Show key={event.id} event={event} />;
}
