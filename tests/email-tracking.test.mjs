import assert from "node:assert/strict";
import { test } from "node:test";
import { deliveryReference, emailTrackingHeader, newEmailTrackingId } from "../lib/email-tracking.ts";

test("SMTP messages have a unique Brevo tracking header", () => {
  const first = newEmailTrackingId();
  const second = newEmailTrackingId();
  assert.notEqual(first, second);
  assert.match(first, /^vtso:[0-9a-f-]{36}$/);
  assert.equal(emailTrackingHeader(first), `tracking_id:${first}`);
  assert.throws(() => emailTrackingHeader("other"));
});

test("SMTP delivery webhooks correlate by custom header, not Brevo's own message ID", () => {
  const trackingId = newEmailTrackingId();
  assert.equal(deliveryReference({ "X-Mailin-custom": `other:value|${emailTrackingHeader(trackingId)}`, "message-id": "brevo-id" }), trackingId);
});

test("older API delivery webhooks still correlate by provider message ID", () => {
  assert.equal(deliveryReference({ "message-id": "legacy-api-id" }), "legacy-api-id");
  assert.equal(deliveryReference({ "message-id": "" }), null);
});
