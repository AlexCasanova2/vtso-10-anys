import type { EventDay } from "@/lib/types";

export function isRegistrationOpen(event: Pick<EventDay, "registration_opens_at" | "registration_closes_at" | "status">, now = new Date()) {
  return ["scheduled", "registration_open"].includes(event.status)
    && now >= new Date(event.registration_opens_at)
    && now < new Date(event.registration_closes_at);
}
