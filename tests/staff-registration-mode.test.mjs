import assert from "node:assert/strict";
import { test } from "node:test";
import { eventSchema, fullStaffRegistrationSchema, staffRegistrationSchema } from "../lib/validation.ts";

const intake = { eventId: "c0a9e565-6278-45fa-a8ad-3814958753b4", ticketCode: "TICKET-1", amountCents: 8000,
  firstName: "Anna", email: "anna@example.com" };
const full = { ...intake, lastName: "Soler", documentType: "dni", documentNumber: "12345678Z",
  clubMember: true, legalAccepted: true };

test("full staff registration requires identity and both in-person confirmations", () => {
  assert.equal(staffRegistrationSchema.safeParse(intake).success, true);
  assert.equal(fullStaffRegistrationSchema.safeParse(intake).success, false);
  assert.equal(fullStaffRegistrationSchema.safeParse(full).success, true);
  assert.equal(fullStaffRegistrationSchema.safeParse({ ...full, clubMember: false }).success, false);
  assert.equal(fullStaffRegistrationSchema.safeParse({ ...full, legalAccepted: false }).success, false);
  assert.equal(fullStaffRegistrationSchema.safeParse({ ...full, documentNumber: "12345678A" }).success, false);
});

test("new events default to full staff registration and explicitly allow invitation mode", () => {
  const event = { name: "Jornada", startsAt: "2026-10-10T18:00:00Z", registrationOpensAt: "2026-10-10T10:00:00Z",
    registrationClosesAt: "2026-10-10T17:50:00Z", prizeCount: 13, prizeValueCents: 25000, venue: "Viladecans",
    clubSignupUrl: "https://example.com/club", termsUrl: "https://example.com/terms", privacyUrl: "https://example.com/privacy",
    publicMessage: "40 premis de 250 €", status: "scheduled" };
  assert.equal(eventSchema.parse(event).staffRegistrationFull, true);
  assert.equal(eventSchema.parse({ ...event, staffRegistrationFull: false }).staffRegistrationFull, false);
  assert.equal(eventSchema.safeParse({ ...event, staffRegistrationFull: "false" }).success, false);
});
