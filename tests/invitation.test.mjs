import assert from "node:assert/strict";
import { test } from "node:test";
import { hashInvitationToken, invitationUrl, newInvitationToken } from "../lib/invitation.ts";
import { renderInvitationEmail } from "../lib/invitation-email.ts";
import { registrationSchema, staffRegistrationSchema } from "../lib/validation.ts";

test("invitation tokens are unique and only their hashes need to be stored", () => {
  const first = newInvitationToken();
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.notEqual(first, newInvitationToken());
  assert.equal(hashInvitationToken(first), hashInvitationToken(first));
  assert.notEqual(hashInvitationToken(first), first);
  assert.throws(() => hashInvitationToken("invalid"));
});

test("completion URLs use a trusted configured HTTPS origin", () => {
  const token = newInvitationToken();
  assert.equal(invitationUrl(token, "https://example.com"), `https://example.com/registro/${token}`);
  assert.throws(() => invitationUrl(token, undefined));
  assert.throws(() => invitationUrl(token, "http://example.com"));
});

test("invitation email never presents the invitation as a confirmed participation", () => {
  const url = invitationUrl(newInvitationToken(), "https://example.com");
  const content = renderInvitationEmail({ firstName: "<Anna>", eventName: "Dia & Club", url, expiresAt: "2 d’octubre" });
  assert.ok(content.text.includes(url));
  assert.ok(content.text.includes("Encara no participes"));
  assert.ok(content.html.includes("&lt;Anna&gt;"));
  assert.ok(content.html.includes("Dia &amp; Club"));
  assert.ok(!content.html.includes("<Anna>"));
});

test("staff only prepares the ticket, while the participant must accept the bases", () => {
  const intake = staffRegistrationSchema.safeParse({ eventId: "c0a9e565-6278-45fa-a8ad-3814958753b4",
    ticketCode: "TICKET-1", amountCents: 8000, firstName: "Anna", email: "anna@example.com" });
  assert.equal(intake.success, true);
  const completion = { token: newInvitationToken(), lastName: "Soler", documentType: "dni",
    documentNumber: "12345678Z", legalAccepted: true };
  assert.equal(registrationSchema.safeParse(completion).success, true);
  assert.equal(registrationSchema.safeParse({ ...completion, legalAccepted: false }).success, false);
  assert.equal(registrationSchema.safeParse({ ...completion, documentNumber: "12345678A" }).success, false);
});
