import assert from "node:assert/strict";
import { test } from "node:test";
import { isRegistrationOpen } from "../lib/registration-window.ts";

const event = {
  registration_opens_at: "2026-10-01T10:00:00.000Z",
  registration_closes_at: "2026-10-01T12:00:00.000Z",
  status: "registration_open",
};

test("shows the registration form only during an open registration window", () => {
  assert.equal(isRegistrationOpen(event, new Date("2026-10-01T09:59:59.999Z")), false);
  assert.equal(isRegistrationOpen(event, new Date(event.registration_opens_at)), true);
  assert.equal(isRegistrationOpen(event, new Date("2026-10-01T11:00:00.000Z")), true);
  assert.equal(isRegistrationOpen(event, new Date(event.registration_closes_at)), false);
});

test("hides registration when closed, drawing or completed regardless of time", () => {
  for (const status of ["registration_closed", "drawing", "completed", "draft"]) {
    assert.equal(isRegistrationOpen({ ...event, status }, new Date("2026-10-01T11:00:00.000Z")), false);
  }
});
