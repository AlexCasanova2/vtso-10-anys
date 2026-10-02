import assert from "node:assert/strict";
import { test } from "node:test";
import { generateNumbers, resolveDrawOrder } from "../lib/draw-order.ts";

test("the prepared order contains every assigned number exactly once", () => {
  const assigned = [794, 222, 303, 895, 425, 182, 417];
  const order = generateNumbers("test-draw-seed", assigned);
  assert.equal(order.length, 7);
  assert.deepEqual([...order].sort((a, b) => a - b), [...assigned].sort((a, b) => a - b));
  assert.equal(new Set(order).size, assigned.length);
});

test("the order is deterministic and does not modify the original entries", () => {
  const assigned = [3, 1, 2];
  const first = generateNumbers("test-draw-seed", assigned);
  assert.deepEqual(first, generateNumbers("test-draw-seed", [2, 3, 1]));
  assert.deepEqual(assigned, [3, 1, 2]);
  assert.deepEqual(generateNumbers("test-draw-seed", []), []);
});

test("the whole capacity of a jornada remains available to draw", () => {
  const order = generateNumbers("test-draw-seed", Array.from({ length: 1000 }, (_, number) => number));
  assert.equal(order.length, 1000);
  assert.equal(new Set(order).size, 1000);
});

test("an older truncated sequence can continue without repeating its prefix", () => {
  const assigned = [794, 222, 303, 895, 425, 182, 417];
  const complete = generateNumbers("test-draw-seed", assigned);
  const prepared = { algorithm: "hmac-sha256-registered-without-replacement-v2", numbers: complete.slice(0, 4) };
  assert.deepEqual(resolveDrawOrder("test-draw-seed", assigned, prepared), complete);
  assert.deepEqual(resolveDrawOrder("test-draw-seed", assigned, { ...prepared, numbers: complete }), complete);
});
