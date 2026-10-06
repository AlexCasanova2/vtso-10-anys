import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";
import ts from "typescript";

// Cargar el adaptador sin credenciales ni acceso a Supabase; conservar sus consultas reales.
const source = await readFile(new URL("../lib/draw-sequence.ts", import.meta.url), "utf8");
const replacements = {
  "@/lib/api": "data:text/javascript,export const apiError = () => {};",
  "@/lib/supabase/admin": "data:text/javascript,export const createAdminClient = () => {};",
  "@/lib/draw-order": new URL("../lib/draw-order.ts", import.meta.url).href,
  "@/lib/draw-history": new URL("../lib/draw-history.ts", import.meta.url).href,
};
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
const isolated = compiled.replace(/"(@\/lib\/[^"]+)"/g, (_, path) => JSON.stringify(replacements[path]));
const { getDrawHistory, getDrawState } = await import(`data:text/javascript;base64,${Buffer.from(isolated).toString("base64")}`);

function client(rows) {
  const ranges = [];
  return { ranges, from(table) {
    assert.equal(table, "audit_logs");
    let columns;
    const query = {
      select(value) { columns = value.split(","); return query; },
      eq() { return query; }, in() { return query; }, order() { return query; }, limit() { return query; },
      maybeSingle() { return Promise.resolve({ data: { payload: { numbers: [347, 92] }, created_at: "2026-10-10" } }); },
      range(start, end) {
        ranges.push([start, end]);
        return Promise.resolve({ data: rows.slice(start, end + 1).map((row) => Object.fromEntries(columns.map((column) => [column, row[column]]))) });
      },
    };
    return query;
  } };
}

const log = (action, number, position) => ({ action: `draw.${action}`, payload: { number, position }, created_at: "2026-10-10T10:00:00Z" });

test("database projection preserves actions and the last unawarded draw", async () => {
  const supabase = client([
    log("number_revealed", 347, 1), log("number_absent", 347, 1),
    log("number_revealed", 92, 1), log("number_absent", 92, 1), log("prize_unawarded", undefined, 1),
  ]);
  const history = await getDrawHistory(supabase, "event");
  assert.equal(history.length, 2);
  assert.equal(history.at(-1).status, "absent");
  const state = await getDrawState(supabase, "event");
  assert.equal(state.current_draw.number, 92);
  assert.equal(state.current_draw.attempt, 2);
  assert.equal(state.current_draw.unawarded, true);
});

test("database history continues past the first thousand audit rows", async () => {
  const supabase = client([...Array.from({ length: 1000 }, (_, number) => log("number_revealed", number, 1)), log("prize_unawarded", undefined, 1)]);
  const history = await getDrawHistory(supabase, "event");
  assert.equal(history.length, 1000);
  assert.equal(history.at(-1).unawarded, true);
  assert.deepEqual(supabase.ranges, [[0, 999], [1000, 1999]]);
});
