import assert from "node:assert/strict";
import { test } from "node:test";
import { resolveDrawHistory } from "../lib/draw-history.ts";

const log = (action, number, position) => ({ action: `draw.${action}`, payload: { number, position }, created_at: "2026-10-10T10:00:00Z" });

test("two absent attempts close their prize without awarding the second number", () => {
  const history = resolveDrawHistory([
    log("number_revealed", 347, 1), log("number_absent", 347, 1),
    log("number_revealed", 92, 1), log("number_absent", 92, 1),
    log("prize_unawarded", undefined, 1), log("number_revealed", 222, 2),
  ]);
  assert.deepEqual(history.map(({ attempt, status, unawarded }) => ({ attempt, status, unawarded })), [
    { attempt: 1, status: "absent", unawarded: true },
    { attempt: 2, status: "absent", unawarded: true },
    { attempt: 1, status: "awarded", unawarded: false },
  ]);
});

test("last unawarded prize remains absent without a subsequent revelation", () => {
  const history = resolveDrawHistory([
    log("number_revealed", 347, 1), log("number_revealed", 92, 1),
    log("number_absent", 92, 1), log("prize_unawarded", undefined, 1),
  ]);
  assert.equal(history.at(-1).status, "absent");
  assert.equal(history.at(-1).unawarded, true);
  assert.equal(history.at(-1).attempt, 2);
});

test("legacy repeated rounds retain their inferred absences", () => {
  const history = resolveDrawHistory([log("number_revealed", 1, 1), log("number_revealed", 2, 1), log("number_revealed", 3, 1)]);
  assert.deepEqual(history.map((row) => row.status), ["absent", "absent", "awarded"]);
  assert.equal(history.at(-1).attempt, 3);
});
