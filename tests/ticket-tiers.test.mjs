import assert from "node:assert/strict";
import { test } from "node:test";
import { ticketNumberCount } from "../lib/ticket-tiers.ts";

test("assigns the correct number of entries at each ticket threshold", () => {
  for (const [cents, count] of [[0, 0], [5999, 0], [6000, 1], [7999, 1], [8000, 2], [9999, 2], [10000, 3], [25000, 3]]) {
    assert.equal(ticketNumberCount(cents), count, `amount: ${cents}`);
  }
});

test("rejects partial cents and invalid values", () => {
  assert.equal(ticketNumberCount(7999.5), 0);
  assert.equal(ticketNumberCount(Number.NaN), 0);
});
