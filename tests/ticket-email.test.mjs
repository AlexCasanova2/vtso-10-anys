import assert from "node:assert/strict";
import { test } from "node:test";
import { renderTicketEmail } from "../lib/ticket-email.ts";

const details = {
  firstName: "Marina",
  eventName: "Jornada de prova",
  eventDate: "1 d’octubre de 2026, 12:00",
  venue: "Viladecans The Style Outlets",
  termsUrl: "https://example.com/terms",
  privacyUrl: "https://example.com/privacy",
};

test("one email includes every participation number in HTML and plain text", () => {
  const { htmlContent, textContent } = renderTicketEmail({ ...details, numbers: [7, 83, 426, 998] });
  for (const number of ["007", "083", "426", "998"]) {
    assert.ok(htmlContent.includes(`>${number}</td>`));
    assert.ok(textContent.includes(number));
  }
  assert.ok(htmlContent.includes("4 números de participació"));
  assert.ok(htmlContent.includes(details.eventDate));
  assert.ok(textContent.includes(details.venue));
});

test("personal and event details are escaped in HTML", () => {
  const { htmlContent } = renderTicketEmail({
    ...details, firstName: '<Marina & "Co">', eventName: "Dia <especial>",
    venue: "Centre & Club", termsUrl: 'https://example.com/?a=1&b="2"', numbers: [1],
  });
  assert.ok(htmlContent.includes("&lt;Marina &amp; &quot;Co&quot;&gt;"));
  assert.ok(htmlContent.includes("Dia &lt;especial&gt;"));
  assert.ok(htmlContent.includes("Centre &amp; Club"));
  assert.ok(htmlContent.includes('href="https://example.com/?a=1&amp;b=&quot;2&quot;"'));
  assert.ok(!htmlContent.includes("<Marina"));
  assert.ok(htmlContent.includes("Aquest és el teu número"));
});

test("cannot generate an email without participation numbers", () => {
  assert.throws(() => renderTicketEmail({ ...details, numbers: [] }), /No hi ha números/);
});
