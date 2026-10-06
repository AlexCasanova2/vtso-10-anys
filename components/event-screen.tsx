"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Users } from "lucide-react";
import { usePublicEvent } from "@/components/use-public-event";
import { Brand } from "@/components/brand";
import { CampaignConfetti } from "@/components/campaign-confetti";

function Countdown({ target }: { target: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const left = Math.max(0, new Date(target).getTime() - now);
  const parts = [Math.floor(left / 86400000), Math.floor(left / 3600000) % 24, Math.floor(left / 60000) % 60, Math.floor(left / 1000) % 60];
  return <div className="countdown">{parts.map((part, index) => <div key={index}><strong>{String(part).padStart(2, "0")}</strong><span>{["dies", "hores", "min", "seg"][index]}</span></div>)}</div>;
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

  if (event === undefined) return <main className="event-shell campaign-shell loading">Preparant la celebració…</main>;
  if (!event) return <main className="event-shell campaign-shell empty"><Brand inverse /><h1 className="display">Properament</h1><p>La pròxima jornada apareixerà aquí quan estigui configurada.</p></main>;

  const open = new Date() >= new Date(event.registration_opens_at) && new Date() < new Date(event.registration_closes_at) && ["scheduled", "registration_open"].includes(event.status);

  return (
    <main className={`event-shell campaign-shell ${displayMode ? "display-mode" : ""}`}>
      <CampaignConfetti />
      <nav><Brand inverse /><span className="anniversary">10 <small>ANYS JUNTS</small></span></nav>
      <section className="event-hero">
        <div className="event-copy">
          <p className="eyebrow">Fem 10 anys</p>
          <h1 className="display">Regalem<br /><mark>10.000 €</mark></h1>
          <p className="event-message">{event.public_message || "40 premis de 250 €. Serà teu?"}</p>
          <p className="eyebrow countdown-title">El sorteig comença d&apos;aquí a</p><Countdown target={event.starts_at} />
        </div>
        <aside className="join-card">
          <Image className="campaign-seal" src="/brand/sello.png" alt="10, 17 i 24 d’octubre" width={279} height={279} sizes="140px" />
          <h2 className="display">Presenta el tiquet.<br />Participa.</h2>
          {open && <p>Inscripció presencial al punt d&apos;atenció. 60 €: 1 número · 80 €: 2 números · 100 € o més: 3 números.</p>}
          <div className="participant-stat"><Users size={22} /><strong>{event.participant_count}</strong><span>números assignats avui</span></div>
          {!open && <p className="closed-note">La inscripció està tancada en aquest moment.</p>}
        </aside>
      </section>
      <div className="campaign-ribbon" aria-hidden="true"><Image src="/brand/lazo.png" alt="" width={326} height={331} sizes="110px" /></div>
      <footer><span>{event.name}</span><span>{event.venue}</span></footer>
    </main>
  );
}
