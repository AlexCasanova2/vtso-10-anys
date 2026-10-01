import assert from "node:assert/strict";
import { test } from "node:test";
import { eventSchema } from "../lib/validation.ts";

const event = {
  name: "Jornada de prova",
  registrationOpensAt: "2026-10-10T08:00:00.000Z",
  registrationClosesAt: "2026-10-10T10:00:00.000Z",
  startsAt: "2026-10-10T10:10:00.000Z",
  prizeCount: 40,
  prizeValueCents: 25000,
  venue: "Viladecans",
  clubSignupUrl: "https://example.com/club",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
  publicMessage: "40 premis de 250 €. Serà teu?",
  status: "scheduled",
};

test("accepts dates with registration closed before the draw", () => {
  assert.equal(eventSchema.safeParse(event).success, true);
  assert.equal(eventSchema.safeParse({ ...event, startsAt: event.registrationClosesAt }).success, true);
});

test("rejects dates that violate the database event window constraint", () => {
  for (const dates of [
    { registrationClosesAt: event.registrationOpensAt },
    { registrationOpensAt: event.registrationClosesAt },
    { startsAt: "2026-10-10T09:00:00.000Z" },
  ]) {
    const result = eventSchema.safeParse({ ...event, ...dates });
    assert.equal(result.success, false);
    assert.match(result.error.issues[0].message, /inscripció|sorteig/);
  }
});
