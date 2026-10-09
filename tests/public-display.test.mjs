import assert from "node:assert/strict";
import { test } from "node:test";
import { DISPLAY_CANVAS_HEIGHT, DISPLAY_CANVAS_WIDTH, getDisplayScale } from "../lib/public-display.ts";

test("the logical canvas matches the physical 2 by 3 metre display", () => {
  assert.equal(DISPLAY_CANVAS_WIDTH / DISPLAY_CANVAS_HEIGHT, 2 / 3);
});

test("1024 by 640 output fills the signal and cancels the physical stretch", () => {
  const { scaleX, scaleY } = getDisplayScale(1024, 640);
  assert.equal(scaleX, 1.6);
  assert.equal(scaleY, 2 / 3);
  assert.equal(DISPLAY_CANVAS_WIDTH * scaleX, 1024);
  assert.equal(DISPLAY_CANVAS_HEIGHT * scaleY, 640);
  assert.ok(Math.abs(scaleX * (2 / 1024) - scaleY * (3 / 640)) < 1e-12);
});

test("a native 2:3 viewport uses uniform scaling", () => {
  const { scaleX, scaleY } = getDisplayScale(1080, 1620);
  assert.equal(scaleX, scaleY);
});

test("safe margins occupy ten centimetres laterally and nine vertically", () => {
  const { scaleX, scaleY } = getDisplayScale(1024, 640);
  const horizontal = DISPLAY_CANVAS_WIDTH * .05 * scaleX * (2 / 1024);
  const vertical = DISPLAY_CANVAS_HEIGHT * .03 * scaleY * (3 / 640);
  assert.ok(Math.abs(horizontal - .1) < 1e-12);
  assert.ok(Math.abs(vertical - .09) < 1e-12);
});

test("invalid output dimensions are rejected", () => {
  for (const [width, height] of [[0, 640], [1024, 0], [-1, 640], [NaN, 640], [1024, Infinity]]) {
    assert.throws(() => getDisplayScale(width, height), RangeError);
  }
});
