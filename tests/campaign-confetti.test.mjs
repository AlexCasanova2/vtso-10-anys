import assert from "node:assert/strict";
import { test } from "node:test";
import { createCampaignConfetti } from "../lib/campaign-confetti.ts";

test("confetti is deterministic and bounded for a continuous screen", () => {
  const particles = createCampaignConfetti();
  assert.equal(particles.length, 40);
  assert.deepEqual(particles, createCampaignConfetti());
  assert.ok(particles.every(particle => particle.duration >= 32 && particle.duration <= 50));
  assert.ok(particles.every(particle => particle.left >= 0 && particle.left <= 100));
  assert.ok(particles.every(particle => particle.delay < 0 && particle.delay > -particle.duration));
});

test("confetti favors the edges and uses the campaign palette", () => {
  const particles = createCampaignConfetti();
  assert.ok(particles.filter(particle => particle.left < 20 || particle.left > 80).length >= 30);
  assert.equal(new Set(particles.map(particle => particle.color)).size, 5);
  assert.ok(particles.some(particle => particle.drift > 0));
  assert.ok(particles.some(particle => particle.drift < 0));
});
