import assert from "node:assert/strict";
import { test } from "node:test";
import { canStartDraw, resolveEventStatus } from "../lib/event-lifecycle.ts";

const event = { status: "scheduled", registration_opens_at: "2026-10-10T08:00:00Z",
  registration_closes_at: "2026-10-10T10:00:00Z", starts_at: "2026-10-10T10:10:00Z", participant_count: 3 };

test("time opens and closes registration but never starts the draw", () => {
  assert.equal(resolveEventStatus(event, new Date("2026-10-10T07:00:00Z")), "scheduled");
  assert.equal(resolveEventStatus(event, new Date("2026-10-10T09:00:00Z")), "registration_open");
  for (const status of ["scheduled", "registration_open", "registration_closed"]) {
    assert.equal(resolveEventStatus({ ...event, status }, new Date("2026-10-10T10:10:00Z")), "registration_closed");
    assert.equal(resolveEventStatus({ ...event, status }, new Date("2026-10-10T18:00:00Z")), "registration_closed");
  }
});

test("manual start requires the time, closed registration and confirmed numbers", () => {
  assert.equal(canStartDraw(event, new Date("2026-10-10T10:09:59Z")), false);
  assert.equal(canStartDraw(event, new Date("2026-10-10T10:10:00Z")), true);
  assert.equal(canStartDraw({ ...event, participant_count: 0 }, new Date("2026-10-10T11:00:00Z")), false);
  assert.equal(canStartDraw({ ...event, registration_closes_at: "2026-10-10T12:00:00Z" }, new Date("2026-10-10T11:00:00Z")), false);
  for (const status of ["draft", "drawing", "completed"]) {
    assert.equal(canStartDraw({ ...event, status }, new Date("2026-10-10T11:00:00Z")), false);
    assert.equal(resolveEventStatus({ ...event, status }, new Date("2026-10-11T11:00:00Z")), status);
  }
});

test("past unstarted days remain archived in the Madrid timezone", () => {
  assert.equal(resolveEventStatus(event, new Date("2026-10-10T21:59:59Z")), "registration_closed");
  assert.equal(resolveEventStatus(event, new Date("2026-10-10T22:00:00Z")), "completed");
});
