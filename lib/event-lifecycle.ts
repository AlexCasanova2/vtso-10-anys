type LifecycleEvent = {
  status: string;
  starts_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
};

const dateKey = (value: string | Date) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit",
}).format(new Date(value));

export function isPastEventDay(startsAt: string, now = new Date()) {
  return dateKey(startsAt) < dateKey(now);
}

export function resolveEventStatus(event: LifecycleEvent, now = new Date()) {
  if (["draft", "completed", "drawing"].includes(event.status)) return event.status;
  if (isPastEventDay(event.starts_at, now)) return "completed";
  if (now >= new Date(event.registration_closes_at)) return "registration_closed";
  if (event.status === "scheduled" && now >= new Date(event.registration_opens_at)) return "registration_open";
  return event.status;
}

export function canStartDraw(event: Pick<LifecycleEvent, "status" | "starts_at" | "registration_closes_at"> & { participant_count: number }, now = new Date()) {
  return ["scheduled", "registration_open", "registration_closed"].includes(event.status)
    && now >= new Date(event.starts_at) && now >= new Date(event.registration_closes_at)
    && event.participant_count > 0;
}
