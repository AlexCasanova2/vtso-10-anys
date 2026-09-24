"use client";

import { FormEvent, startTransition, useDeferredValue, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, ChevronRight, CircleDollarSign, Download, ExternalLink, Gift, LayoutDashboard, LoaderCircle, LogOut, Mail, Pencil, Plus, Search, Settings, TicketCheck, Trash2, UserRound, Users, X } from "lucide-react";
import { createClient } from "@/lib/supabase/browser";
import { formatMoney, formatNumber, type EventDay, type PublicEvent } from "@/lib/types";
import { Brand } from "@/components/brand";

type User = { id: string; full_name: string; role: "admin" | "operator"; email: string };
type AdminEvent = EventDay & { entries: { count: number }[]; draws: { count: number }[] };
type AdminEntry = { id: string; number: number; created_at: string; email_snapshot: string; participants: { id: string; first_name: string; last_name: string; email: string; document_type: string; document_number: string; document_country: string }; email_deliveries: { status: string; created_at: string }[] };
type CrmParticipant = { id: string; first_name: string; last_name: string; email: string; document_type: string; document_number: string; document_country: string; entries: { id: string; number: number; created_at: string; events: { id: string; name: string }; draws: { status: string }[] }[] };
type Tab = "event" | "people" | "settings";

const statusLabels: Record<string, string> = { draft: "Esborrany", scheduled: "Programada", registration_open: "Inscripció oberta", registration_closed: "Inscripció tancada", drawing: "En sorteig", completed: "Finalitzada" };
const deliveryLabels: Record<string, string> = { queued: "En cua", sent: "Enviat", delivered: "Lliurat", bounced: "Rebotat", failed: "Error" };
const activeEventId = (events: AdminEvent[]) => events.find((event) => !["draft", "completed"].includes(event.status))?.id ?? events.at(-1)?.id ?? "";

async function request(url: string, options?: RequestInit) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error ?? "Error inesperat");
  return body;
}

export function AdminDashboard({ user }: { user: User }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("event");
  const [events, setEvents] = useState<AdminEvent[]>([]);
  const [eventId, setEventId] = useState("");
  const [entries, setEntries] = useState<AdminEntry[]>([]);
  const [participants, setParticipants] = useState<CrmParticipant[]>([]);
  const [crmEventId, setCrmEventId] = useState("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);
  const [selected, setSelected] = useState<AdminEntry | null>(null);
  const [publicEvent, setPublicEvent] = useState<PublicEvent | null>(null);
  const [message, setMessage] = useState<{ type: "error" | "success"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [creating, setCreating] = useState(false);
  const current = events.find((event) => event.id === eventId);

  async function loadEvents(preferredId?: string) {
    try {
      const body = await request("/api/admin/events");
      setEvents(body.events);
      setEventId((id) => preferredId ?? (body.events.some((event: AdminEvent) => event.id === id) ? id : activeEventId(body.events)));
    } catch (error) { setMessage({ type: "error", text: (error as Error).message }); }
  }

  useEffect(() => {
    let active = true;
    request("/api/admin/events").then((body) => {
      if (!active) return;
      setEvents(body.events);
      setEventId(activeEventId(body.events));
    }).catch((error) => active && setMessage({ type: "error", text: error.message }));
    return () => { active = false; };
  }, []);
  useEffect(() => {
    if (!eventId) return;
    let active = true;
    const query = new URLSearchParams({ eventId, ...(deferredSearch ? { q: deferredSearch } : {}) });
    request(`/api/admin/entries?${query}`).then((body) => active && setEntries(body.entries)).catch((error) => active && setMessage({ type: "error", text: error.message }));
    request(`/api/public/event?id=${eventId}`).then((body) => active && setPublicEvent(body.event));
    return () => { active = false; };
  }, [eventId, deferredSearch]);
  useEffect(() => {
    if (tab !== "people") return;
    const query = deferredSearch ? `?q=${encodeURIComponent(deferredSearch)}` : "";
    request(`/api/admin/participants${query}`).then((body) => setParticipants(body.participants)).catch((error) => setMessage({ type: "error", text: error.message }));
  }, [tab, deferredSearch]);

  async function draw(action: "extract" | "award" | "absent") {
    if (!eventId) return;
    setBusy(true); setMessage(null);
    try {
      await request("/api/admin/draws", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ eventId, action }) });
      const eventBody = await request(`/api/public/event?id=${eventId}`);
      setPublicEvent(eventBody.event); await loadEvents(eventId);
      setMessage({ type: "success", text: action === "extract" ? "Número extret" : action === "award" ? "Premi lliurat i confirmat" : "Absència registrada. Pots repetir l'extracció." });
    } catch (error) { setMessage({ type: "error", text: (error as Error).message }); } finally { setBusy(false); }
  }

  async function logout() { await createClient().auth.signOut(); router.push("/admin/login"); router.refresh(); }
  function exportEntries() {
    const rows = [["número", "nom", "cognoms", "correu", "document", "data"], ...entries.map((entry) => [formatNumber(entry.number), entry.participants.first_name, entry.participants.last_name, entry.participants.email, `${entry.participants.document_type.toUpperCase()} ${entry.participants.document_number}`, entry.created_at])];
    const csv = rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(",")).join("\n");
    const anchor = document.createElement("a"); anchor.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); anchor.download = `${current?.name ?? "participants"}.csv`; anchor.click(); URL.revokeObjectURL(anchor.href);
  }

  return <main className="admin-shell">
    <aside className="admin-sidebar"><Brand inverse /><nav><button className={tab === "event" ? "active" : ""} onClick={() => setTab("event")}><LayoutDashboard /> Operativa en directe</button><div className={`crm-nav-group ${tab === "people" || (tab === "settings" && !creating) ? "open" : ""}`}><button className={tab === "people" || (tab === "settings" && !creating) ? "active" : ""} onClick={() => { setCrmEventId("all"); setTab("people"); }}><Users /> CRM</button>{(tab === "people" || (tab === "settings" && !creating)) && <div className="crm-submenu"><button className={crmEventId === "all" && tab === "people" ? "selected" : ""} onClick={() => { setCrmEventId("all"); setTab("people"); }}><span /> Totes les jornades</button>{events.map((event, index) => <div className="crm-event-row" key={event.id}><button className={crmEventId === event.id && tab === "people" ? "selected" : ""} onClick={() => { setCrmEventId(event.id); setEventId(event.id); setTab("people"); }} title={`Participants de ${event.name}`}><span>{index + 1}</span><b>{event.name}</b></button>{user.role === "admin" && <button className={crmEventId === event.id && tab === "settings" ? "selected event-settings-button" : "event-settings-button"} onClick={() => { setCrmEventId(event.id); setEventId(event.id); setCreating(false); setTab("settings"); }} title={`Configura ${event.name}`} aria-label={`Configura ${event.name}`}><Settings size={14} /></button>}</div>)}</div>}</div></nav><div className="user-block"><span>{user.full_name}</span><small>{user.role === "admin" ? "Administrador" : "Operador"}</small><button onClick={logout} aria-label="Tanca la sessió"><LogOut size={18} /></button></div></aside>
    <section className="admin-main">
      <header className="admin-topbar"><div><p className="eyebrow">Tauler de control</p><select value={eventId} onChange={(e) => setEventId(e.target.value)}>{events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}</select></div><div className="top-actions"><a className="button secondary small" href="/pantalla" target="_blank">Pantalla pública <ExternalLink size={15} /></a>{user.role === "admin" && <button className="button yellow small" onClick={() => { setCreating(true); setTab("settings"); }}><Plus size={16} /> Nova jornada</button>}</div></header>
      {message && <div className={`admin-message ${message.type}`}><span>{message.text}</span><button onClick={() => setMessage(null)}><X size={16} /></button></div>}
      {tab === "event" && <EventTab event={current} live={publicEvent} entries={entries} search={search} setSearch={setSearch} selected={selected} setSelected={setSelected} busy={busy} draw={draw} exportEntries={exportEntries} onChanged={() => { setSelected(null); loadEvents(eventId); }} setMessage={setMessage} />}
      {tab === "people" && <PeopleTab participants={participants} search={search} setSearch={setSearch} event={events.find((event) => event.id === crmEventId)} canConfigure={user.role === "admin"} onConfigure={() => { if (crmEventId !== "all") { setEventId(crmEventId); setCreating(false); setTab("settings"); } }} />}
      {tab === "settings" && user.role === "admin" && <SettingsTab key={creating ? "new" : current?.id} event={creating ? undefined : current} onCancel={() => { setCreating(false); setTab(current ? "people" : "event"); }} onSaved={(id) => { setCreating(false); setCrmEventId(id); loadEvents(id); setTab("people"); setMessage({ type: "success", text: "Configuració desada" }); }} onDeleted={() => { setCreating(false); setCrmEventId("all"); loadEvents(); setTab("people"); setMessage({ type: "success", text: "Jornada eliminada" }); }} setMessage={setMessage} />}
    </section>
  </main>;
}

function EventTab({ event, live, entries, search, setSearch, selected, setSelected, busy, draw, exportEntries, onChanged, setMessage }: { event?: AdminEvent; live: PublicEvent | null; entries: AdminEntry[]; search: string; setSearch: (v: string) => void; selected: AdminEntry | null; setSelected: (v: AdminEntry | null) => void; busy: boolean; draw: (a: "extract" | "award" | "absent") => void; exportEntries: () => void; onChanged: () => void; setMessage: (v: { type: "error" | "success"; text: string }) => void }) {
  if (!event) return <EmptyAdmin />;
  return <div className="admin-content">
    <div className="operational-intro"><div><p className="eyebrow">Operativa de la jornada</p><h1 className="display">Sorteig en directe</h1></div><p>Espai de treball per gestionar les extraccions, confirmar el lliurament presencial i resoldre incidències durant l&apos;esdeveniment.</p></div>
    <div className="stats"><Stat icon={<Users />} label="Participants" value={String(live?.participant_count ?? 0)} detail={`${1000 - (live?.participant_count ?? 0)} disponibles`} /><Stat icon={<Gift />} label="Premis lliurats" value={`${live?.awarded_count ?? 0}/${event.prize_count}`} detail={formatMoney(event.prize_value_cents) + " cadascun"} /><Stat icon={<CalendarClock />} label="Inici" value={new Intl.DateTimeFormat("ca-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(event.starts_at))} detail={new Intl.DateTimeFormat("ca-ES", { day: "2-digit", month: "long", timeZone: "Europe/Madrid" }).format(new Date(event.starts_at))} /><Stat icon={<CircleDollarSign />} label="Estat" value={statusLabels[event.status]} detail={`Tancament ${new Intl.DateTimeFormat("ca-ES", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(event.registration_closes_at))}`} /></div>
    {event.status === "drawing" && <section className="draw-console card"><div><p className="eyebrow">Sorteig en directe</p><h2 className="display">Premi {(live?.awarded_count ?? 0) + 1} de {event.prize_count}</h2></div>{live?.pending_draw ? <div className="pending-number"><small>Número extret</small><strong>{formatNumber(live.pending_draw.number)}</strong></div> : <button className="extract-button" onClick={() => draw("extract")} disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <TicketCheck />} Extreure un número</button>}{live?.pending_draw && <div className="resolve-buttons"><button className="button danger" disabled={busy} onClick={() => draw("absent")}><X /> No hi és: repetir</button><button className="button confirm" disabled={busy} onClick={() => draw("award")}><Check /> Lliurament confirmat</button></div>}</section>}
    <section className="participants-section"><div className="section-heading"><div><p className="eyebrow">Jornada actual</p><h2 className="display">Participants</h2></div><div className="table-actions"><label className="search-box"><Search size={18} /><input value={search} onChange={(e) => startTransition(() => setSearch(e.target.value))} placeholder="Nom, correu o document" /></label><button className="button secondary small" onClick={exportEntries}><Download size={16} /> CSV</button></div></div>
      <div className="participant-table"><div className="table-head"><span>Núm.</span><span>Participant</span><span>Document</span><span>Correu / enviament</span><span></span></div>{entries.length ? entries.map((entry) => { const lastDelivery = [...entry.email_deliveries].sort((a,b) => b.created_at.localeCompare(a.created_at))[0]; const deliveryStatus = lastDelivery?.status ?? "queued"; return <button className="table-row" key={entry.id} onClick={() => setSelected(entry)}><strong className="number-chip">{formatNumber(entry.number)}</strong><span><b>{entry.participants.first_name} {entry.participants.last_name}</b><small>{new Intl.DateTimeFormat("ca-ES", { hour:"2-digit",minute:"2-digit" }).format(new Date(entry.created_at))}</small></span><span>{entry.participants.document_type.toUpperCase()} · {entry.participants.document_number}</span><span><b>{entry.participants.email}</b><small className={`delivery ${deliveryStatus}`}>{deliveryLabels[deliveryStatus]}</small></span><ChevronRight /></button> }) : <div className="table-empty">No hi ha participants que coincideixin amb la cerca.</div>}</div>
    </section>
    {selected && <IncidentPanel entry={selected} close={() => setSelected(null)} changed={onChanged} setMessage={setMessage} />}
  </div>;
}

function Stat({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string; detail: string }) { return <div className="stat-card"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></div>; }

function IncidentPanel({ entry, close, changed, setMessage }: { entry: AdminEntry; close: () => void; changed: () => void; setMessage: (v: { type: "error" | "success"; text: string }) => void }) {
  const [email, setEmail] = useState(entry.participants.email); const [busy, setBusy] = useState(false);
  async function run(mode: "save" | "resend") { setBusy(true); try { if (mode === "save") await request(`/api/admin/entries/${entry.id}`, { method:"PATCH",headers:{"content-type":"application/json"},body:JSON.stringify({email}) }); else await request(`/api/admin/entries/${entry.id}/resend`, {method:"POST"}); setMessage({type:"success",text:mode === "save" ? "Correu actualitzat sense modificar la participació" : "Correu reenviat amb Brevo"}); changed(); } catch(error) { setMessage({type:"error",text:(error as Error).message}); } finally { setBusy(false); } }
  return <div className="drawer-backdrop" onMouseDown={close}><aside className="incident-drawer" onMouseDown={(e) => e.stopPropagation()}><div className="drawer-head"><div><p className="eyebrow">Incidència del participant</p><h2 className="display">Número {formatNumber(entry.number)}</h2></div><button onClick={close}><X /></button></div><div className="identity-card"><UserRound /><div><strong>{entry.participants.first_name} {entry.participants.last_name}</strong><span>{entry.participants.document_type.toUpperCase()} · {entry.participants.document_number}</span></div></div><div className="field"><label htmlFor="incident-email">Correu electrònic</label><input className="input" id="incident-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div><p className="drawer-help">Canviar el correu no crea una altra participació ni assigna un número nou.</p><button className="button yellow" disabled={busy || email === entry.participants.email} onClick={() => run("save")}><Pencil size={17} /> Desa la correcció</button><button className="button secondary" disabled={busy || email !== entry.participants.email} onClick={() => run("resend")}><Mail size={17} /> Reenvia la targeta</button></aside></div>;
}

function PeopleTab({ participants, search, setSearch, event, canConfigure, onConfigure }: { participants: CrmParticipant[]; search: string; setSearch: (v:string) => void; event?: AdminEvent; canConfigure: boolean; onConfigure: () => void }) {
  const visibleParticipants = participants.map((person) => ({ ...person, entries: event ? person.entries.filter((entry) => entry.events.id === event.id) : person.entries })).filter((person) => person.entries.length > 0);
  const shortDate = (value: string) => new Intl.DateTimeFormat("ca-ES", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Madrid" }).format(new Date(value));
  return <div className="admin-content"><div className="section-heading crm-heading"><div><p className="eyebrow">{event ? "Històric per jornada" : "Històric complet"}</p><h1 className="display">{event?.name ?? "CRM de participants"}</h1>{event && <p className="crm-filter-summary">{visibleParticipants.length} participants en aquesta jornada</p>}</div><div className="crm-heading-actions">{event && canConfigure && <button className="button secondary small" onClick={onConfigure}><Settings size={16} /> Configura la jornada</button>}<label className="search-box"><Search size={18}/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder={event ? "Cerca en aquesta jornada" : "Cerca en les tres jornades"} /></label></div></div>{event && <div className="journey-summary"><div><small>Obertura</small><strong>{shortDate(event.registration_opens_at)}</strong></div><div><small>Tancament</small><strong>{shortDate(event.registration_closes_at)}</strong></div><div><small>Sorteig</small><strong>{shortDate(event.starts_at)}</strong></div><div><small>Premis</small><strong>{event.prize_count} × {formatMoney(event.prize_value_cents)}</strong></div><div><small>Estat</small><strong><i className={`status-dot ${event.status}`} />{statusLabels[event.status]}</strong></div></div>}<div className="crm-grid">{visibleParticipants.map((person)=><article className="crm-card card" key={person.id}><div className="crm-person"><span>{person.first_name[0]}{person.last_name[0]}</span><div><h3>{person.first_name} {person.last_name}</h3><p>{person.email}</p><small>{person.document_type.toUpperCase()} · {person.document_number}</small></div></div><div className="history-label">{person.entries.length} {person.entries.length === 1 ? "jornada" : "jornades"}</div><div className="history-list">{person.entries.map((entry)=><div key={entry.id}><span className="number-chip">{formatNumber(entry.number)}</span><span><b>{entry.events.name}</b><small>{entry.draws.some((draw)=>draw.status === "awarded") ? "Guanyador" : "Hi va participar"}</small></span></div>)}</div></article>)}</div>{!visibleParticipants.length && <div className="table-empty">No hi ha participants que coincideixin amb la jornada i la cerca.</div>}</div>;
}

function SettingsTab({ event, onCancel, onSaved, onDeleted, setMessage }: { event?: AdminEvent; onCancel:()=>void; onSaved:(id:string)=>void; onDeleted:()=>void; setMessage:(v:{type:"error"|"success";text:string})=>void }) {
  const [busy, setBusy] = useState(false);
  const isNew = !event;
  const local = (value?: string) => value ? new Date(new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

  async function submit(submitEvent: FormEvent<HTMLFormElement>) {
    submitEvent.preventDefault();
    setBusy(true);
    const form = new FormData(submitEvent.currentTarget);
    const payload = {
      name: form.get("name"), startsAt: new Date(String(form.get("startsAt"))).toISOString(),
      registrationOpensAt: new Date(String(form.get("registrationOpensAt"))).toISOString(),
      registrationClosesAt: new Date(String(form.get("registrationClosesAt"))).toISOString(),
      prizeCount: Number(form.get("prizeCount")), prizeValueCents: Number(form.get("prizeValue")) * 100,
      venue: form.get("venue"), clubSignupUrl: form.get("clubSignupUrl"), termsUrl: form.get("termsUrl"),
      privacyUrl: form.get("privacyUrl"), publicMessage: form.get("publicMessage"), status: form.get("status"),
    };
    try {
      const body = await request(isNew ? "/api/admin/events" : `/api/admin/events/${event?.id}`, { method: isNew ? "POST" : "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
      const savedId = body.id ?? event?.id;
      if (savedId) onSaved(savedId);
    } catch (error) { setMessage({ type: "error", text: (error as Error).message }); }
    finally { setBusy(false); }
  }

  async function remove() {
    if (!event || !window.confirm(`Vols eliminar definitivament la jornada “${event.name}”?`)) return;
    setBusy(true);
    try {
      await request(`/api/admin/events/${event.id}`, { method: "DELETE" });
      onDeleted();
    } catch (error) { setMessage({ type: "error", text: (error as Error).message }); }
    finally { setBusy(false); }
  }

  return <div className="admin-content settings-content">
    <div className="section-heading"><div><p className="eyebrow">{isNew ? "Nova jornada" : "Gestió independent de la jornada"}</p><h1 className="display">{isNew ? "Crea una jornada" : event?.name}</h1>{event && <p className="crm-filter-summary">Dates, premis, estat i enllaços propis d&apos;aquesta jornada</p>}</div><button className="button secondary small" onClick={onCancel}>Tornar</button></div>
    <form className="settings-form card" onSubmit={submit}>
      <fieldset><legend>Informació pública</legend><div className="field"><label>Nom de la jornada</label><input className="input" name="name" defaultValue={event?.name} required /></div><div className="field"><label>Lloc</label><input className="input" name="venue" defaultValue={event?.venue} required /></div><div className="field full"><label>Missatge de la pantalla</label><input className="input" name="publicMessage" defaultValue={event?.public_message || "40 premis de 250 €. Serà teu?"} required /></div></fieldset>
      <fieldset><legend>Dates i premis</legend><div className="field"><label>Obertura de la inscripció</label><input className="input" name="registrationOpensAt" type="datetime-local" defaultValue={local(event?.registration_opens_at)} required /></div><div className="field"><label>Tancament de la inscripció</label><input className="input" name="registrationClosesAt" type="datetime-local" defaultValue={local(event?.registration_closes_at)} required /><small>Recomanat: 10 minuts abans.</small></div><div className="field"><label>Inici del sorteig</label><input className="input" name="startsAt" type="datetime-local" defaultValue={local(event?.starts_at)} required /></div><div className="field"><label>Nombre de premis</label><input className="input" name="prizeCount" type="number" min="1" max="40" defaultValue={event?.prize_count ?? 13} required /></div><div className="field"><label>Import per premi (€)</label><input className="input" name="prizeValue" type="number" min="1" defaultValue={(event?.prize_value_cents ?? 25000) / 100} required /></div><div className="field"><label>Estat de la jornada</label><select className="input" name="status" defaultValue={event?.status ?? "draft"}>{Object.entries(statusLabels).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></div></fieldset>
      <fieldset><legend>Enllaços legals i Club</legend><div className="field full"><label>Alta del Club Style Outlets</label><input className="input" name="clubSignupUrl" type="url" defaultValue={event?.club_signup_url} placeholder="https://" required /></div><div className="field"><label>Bases legals</label><input className="input" name="termsUrl" type="url" defaultValue={event?.terms_url} placeholder="https://" required /></div><div className="field"><label>Política de privacitat</label><input className="input" name="privacyUrl" type="url" defaultValue={event?.privacy_url} placeholder="https://" required /></div></fieldset>
      {event && <div className="verification-box"><strong>Compromís criptogràfic</strong><code>{event.draw_seed_commitment}</code><small>La llavor es revela en finalitzar la jornada per verificar les extraccions.</small></div>}
      <div className="settings-actions"><button className="button yellow" disabled={busy}>{busy ? <LoaderCircle className="spin" /> : <Check />} Desa la configuració</button></div>
    </form>
    {event && <section className="danger-zone"><div><strong>Elimina la jornada</strong><p>Només es pot eliminar si encara no té participacions. Les jornades amb historial s&apos;han de finalitzar.</p></div><button className="button danger small" type="button" disabled={busy} onClick={remove}><Trash2 size={16} /> Elimina</button></section>}
  </div>;
}

function EmptyAdmin(){return <div className="empty-admin"><Gift/><h2 className="display">Encara no hi ha jornades</h2><p>Crea la primera jornada per començar.</p></div>;}
