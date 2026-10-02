"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { usePublicEvent } from "@/components/use-public-event";
import { Brand } from "@/components/brand";

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, new Date(target).getTime() - now);
  const parts = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  return <div className="countdown" aria-label="Temps fins al sorteig">{parts.map((part, index) => <div key={index}><strong>{String(part).padStart(2, "0")}</strong><span>{["dies", "hores", "min", "seg"][index]}</span></div>)}</div>;
}

export function EventScreen({ displayMode = false }: { displayMode?: boolean }) {
  const event = usePublicEvent();
  const router = useRouter();
  useEffect(() => {
    if (!event || event.status === "completed") return;
    const destination = `/sorteig?jornada=${encodeURIComponent(event.id)}`;
    router.prefetch(destination);
    const remaining = new Date(event.starts_at).getTime() - Date.now();
    if (event.status === "drawing" || remaining <= 0) {
      router.replace(destination);
      return;
    }
    const timer = setTimeout(() => router.replace(destination), Math.min(remaining, 2147483647));
    return () => clearTimeout(timer);
  }, [event, router]);

  if (event === undefined) return <main className="event-shell loading">Preparant la celebració…</main>;
  if (!event) return <main className="event-shell empty"><Brand /><h1 className="display">Properament</h1><p>La pròxima jornada apareixerà aquí quan estigui configurada.</p></main>;

  const open = new Date() >= new Date(event.registration_opens_at) && new Date() < new Date(event.registration_closes_at) && ["scheduled", "registration_open"].includes(event.status);
  const upcoming = new Date() < new Date(event.registration_opens_at);

  return (
    <main className={`event-shell ${displayMode ? "display-mode" : ""}`}>
      <div className="ambient-shapes" aria-hidden="true"><span className="orbit orbit-one" /><span className="orbit orbit-two" /><span className="brand-triangle triangle-one" /><span className="brand-triangle triangle-two" /><span className="brand-triangle triangle-three" /><span className="giant-ten">10</span></div>
      <nav><Brand /><span className="anniversary">10 <small>ANYS</small></span></nav>
      <div className="event-content">
        <section className="event-hero" aria-label="Premis i participació">
          <div className="event-copy">
            <p className="eyebrow">Celebrem 10 anys junts</p>
            <h1 className="display" aria-label="40 premis de 250 €"><span className="prize-count">40</span><span className="prize-description">premis de</span><span className="prize-value">250 €</span></h1>
            <p className="event-total">10.000 € en premis</p>
            {event.public_message && event.public_message !== "40 premis de 250 €. Serà teu?" && <p className="event-message">{event.public_message}</p>}
          </div>
          <aside className="join-card">
            <p className={`join-status ${open ? "is-open" : "is-closed"}`}>{open ? "Inscripcions obertes" : upcoming ? "Inscripcions properament" : "Inscripcions tancades"}</p>
            {!open && !upcoming ? <>
              <h2 className="display">El sorteig s&apos;acosta</h2>
              <p className="join-closed-copy">Si ja t&apos;has inscrit, revisa el correu i prepara els teus números per al sorteig.</p>
            </> : <>
              <h2 className="display">Com hi participes?</h2>
              <ol className="join-steps">
                <li><strong>Compra per 60 € o més</strong><span>Guarda el tiquet de compra.</span></li>
                <li><strong>Ves al punt d&apos;atenció</strong><span>Presenta el tiquet i acredita que ets del Club.</span></li>
                <li><strong>Revisa el teu correu</strong><span>Completa les dades per rebre els teus números.</span></li>
              </ol>
              <div className="ticket-tiers" aria-label="Números segons l'import del tiquet">
                <div><strong>60 €</strong><span>1 número</span></div>
                <div><strong>80 €</strong><span>2 números</span></div>
                <div><strong>100 € o més</strong><span>3 números</span></div>
              </div>
            </>}
          </aside>
        </section>
        <section className="event-timing" aria-label="Compte enrere per al sorteig">
          <div><p className="eyebrow">Pròxim gran moment</p><h2 className="display">El sorteig comença d&apos;aquí a</h2></div>
          <Countdown target={event.starts_at} />
          <p className="event-participation-count"><strong>{event.participant_count}</strong><span>números assignats</span></p>
        </section>
      </div>
      <div className="event-ticker" aria-hidden="true"><div className="ticker-track"><div className="ticker-group"><span>40 PREMIS DE 250 €</span><i>◆</i><span>10 ANYS JUNTS</span><i>◆</i><span>10.000 € EN PREMIS</span><i>◆</i></div><div className="ticker-group"><span>40 PREMIS DE 250 €</span><i>◆</i><span>10 ANYS JUNTS</span><i>◆</i><span>10.000 € EN PREMIS</span><i>◆</i></div></div></div>
      <footer><span>{event.name}</span><span>{event.venue}</span></footer>
    </main>
  );
}
