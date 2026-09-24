export type EventStatus = "draft" | "scheduled" | "registration_open" | "registration_closed" | "drawing" | "completed";

export type EventDay = {
  id: string;
  name: string;
  starts_at: string;
  registration_opens_at: string;
  registration_closes_at: string;
  prize_count: number;
  prize_value_cents: number;
  status: EventStatus;
  venue: string;
  club_signup_url: string;
  terms_url: string;
  privacy_url: string;
  public_message: string;
  draw_seed_commitment: string;
  draw_seed_revealed: string | null;
};

export type PublicEvent = EventDay & {
  participant_count: number;
  revealed_count: number;
  current_draw?: { number: number; position: number; revealed_at: string } | null;
};

export type Entry = {
  id: string;
  number: number;
  created_at: string;
  participant: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
    document_type: "dni" | "nie" | "passport";
    document_number: string;
    document_country: string;
  };
  email_status?: string;
};

export const formatNumber = (number: number) => number.toString().padStart(3, "0");

export const formatMoney = (cents: number) =>
  new Intl.NumberFormat("ca-ES", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(cents / 100);

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("ca-ES", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Madrid" }).format(new Date(value));
