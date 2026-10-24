import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { after, before, beforeEach, test } from "node:test";
import { PGlite } from "@electric-sql/pglite";

const event = "00000000-0000-4000-8000-000000000001";
const actor = "00000000-0000-4000-8000-000000000002";
let db;

before(async () => {
  db = new PGlite();
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create table profiles (id uuid primary key, role text);
    create table events (id uuid primary key, status text, starts_at timestamptz,
      registration_closes_at timestamptz, prize_count integer, updated_at timestamptz);
    create table entries (event_id uuid, number integer, email_snapshot text);
    create table audit_logs (id bigint generated always as identity primary key,
      actor_id uuid, action text, entity_type text, entity_id text,
      payload jsonb default '{}', created_at timestamptz default clock_timestamp());
    insert into profiles values ('${actor}', 'operator');
  `);
  for (const migration of ["202610020001_prepare_draw_sequence.sql", "202610060001_manual_draw_start.sql",
    "202610060002_two_draw_attempts.sql"]) {
    await db.exec(await readFile(new URL(`../supabase/migrations/${migration}`, import.meta.url), "utf8"));
  }
  if (process.env.TEST_DRAW_WRAPPER === "1") {
    await db.exec(`
      alter function advance_draw_event(uuid,uuid,text,integer,integer[]) rename to advance_draw_event_unrestricted;
      create function advance_draw_event(uuid,uuid,text,integer,integer[]) returns jsonb
        language sql security definer set search_path = '' as
        'select public.advance_draw_event_unrestricted($1,$2,$3,$4,$5)';
      revoke all on function advance_draw_event(uuid,uuid,text,integer,integer[]) from public, anon, authenticated;
      grant execute on function advance_draw_event(uuid,uuid,text,integer,integer[]) to service_role;
    `);
  }
  const [previous] = await db.query("select pg_get_functiondef('advance_draw_event(uuid,uuid,text,integer,integer[])'::regprocedure) as definition").then(result => result.rows);
  await db.exec(await readFile(new URL("../supabase/migrations/202610240001_configurable_draw_attempts.sql", import.meta.url), "utf8"));
  if (process.env.TEST_DRAW_WRAPPER === "1") {
    const [current] = await db.query("select pg_get_functiondef('advance_draw_event(uuid,uuid,text,integer,integer[])'::regprocedure) as definition").then(result => result.rows);
    assert.equal(current.definition, previous.definition);
  }
});
after(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`truncate events, entries, audit_logs;
    insert into events (id, status, starts_at, registration_closes_at, prize_count)
      values ('${event}', 'drawing', now(), now() - interval '1 hour', 2);
    insert into entries select '${event}', n, 'person' || n || '@example.invalid'
      from generate_series(1, 6) n;
    insert into audit_logs (action, entity_type, entity_id, payload)
      values ('draw.number_revealed', 'event', '${event}', '{"number":1,"position":1}');
  `);
});
const query = async (sql, args = []) => (await db.query(sql, args)).rows;
const unlimited = () => query("update events set limit_draw_attempts = false where id = $1", [event]);
const advance = async (number, action = "redraw", who = actor) => (await query(
  "select advance_draw_event($1, $2, $3, $4, array[1,2,3,4,5,6]) as result",
  [event, who, action, number]))[0].result;
const logs = () => query("select action, payload from audit_logs order by id");

test("two attempts remain the default, including early skip and final prize behavior", async () => {
  assert.equal((await query("select limit_draw_attempts from events"))[0].limit_draw_attempts, true);
  await assert.rejects(advance(1, "skip"), /SKIP_NOT_ALLOWED/);
  await advance(1);
  await assert.rejects(advance(2), /ATTEMPT_LIMIT/);
  assert.deepEqual(await advance(2, "skip"), { number: 3, position: 2, unawarded: true });
  await advance(3);
  assert.deepEqual(await advance(4, "skip"), { number: null, position: 2, unawarded: true });
});

test("unlimited mode keeps the same prize beyond two attempts without repeating numbers", async () => {
  await unlimited();
  for (let number = 1; number < 5; number++) {
    assert.deepEqual(await advance(number), { number: number + 1, position: 1, unawarded: false });
  }
  const history = await logs();
  assert.equal(history.filter(row => row.action === "draw.number_absent").length, 4);
  assert.equal(history.some(row => row.action === "draw.prize_unawarded"), false);
  assert.deepEqual(history.filter(row => row.action === "draw.number_revealed").map(row => row.payload.number), [1, 2, 3, 4, 5]);
});

test("staff can stop after any attempt in unlimited mode and closed prizes stay closed", async () => {
  await unlimited();
  assert.deepEqual(await advance(1, "skip"), { number: 2, position: 2, unawarded: true });
  await advance(2);
  await advance(3);
  assert.deepEqual(await advance(4, "skip"), { number: null, position: 2, unawarded: true });
  await assert.rejects(advance(4), /PRIZE_CLOSED/);
  await assert.rejects(advance(4, "skip"), /PRIZE_CLOSED/);
  assert.equal((await logs()).filter(row => row.action === "draw.prize_unawarded").length, 2);
});

test("exhaustion rolls back a failed redraw; staff can still close the prize", async () => {
  await unlimited();
  for (let number = 1; number < 6; number++) await advance(number);
  const previous = await logs();
  await assert.rejects(advance(6), /NO_ELIGIBLE_ENTRIES/);
  assert.deepEqual(await logs(), previous);
  assert.deepEqual(await advance(6, "skip"), { number: null, position: 1, unawarded: true });
});

test("changing the setting mid-draw applies immediately without erasing attempts", async () => {
  await advance(1);
  await assert.rejects(advance(2), /ATTEMPT_LIMIT/);
  await unlimited();
  await advance(2);
  await query("update events set limit_draw_attempts = true");
  await assert.rejects(advance(3), /ATTEMPT_LIMIT/);
  assert.deepEqual(await advance(3, "skip"), { number: 4, position: 2, unawarded: true });
});

test("unlimited mode preserves authorization, stale request and state checks", async () => {
  await unlimited();
  await assert.rejects(advance(1, "redraw", event), /UNAUTHORIZED/);
  await advance(1);
  const previous = await logs();
  await assert.rejects(advance(1), /STALE_DRAW/);
  await assert.rejects(advance(2, "invalid"), /INVALID_ACTION/);
  await query("update events set status = 'completed'");
  await assert.rejects(advance(2), /DRAW_NOT_OPEN/);
  assert.deepEqual(await logs(), previous);
});

test("normal advancement awards the current prize without marking it absent", async () => {
  await unlimited();
  assert.deepEqual(await advance(1, "extract"), { number: 2, position: 2, unawarded: false });
  assert.equal((await logs()).some(row => row.action === "draw.number_absent"), false);
  await assert.rejects(advance(2, "extract"), /DRAW_FINISHED/);
});

test("the internal function remains inaccessible to API roles", async () => {
  const [result] = await query(`select bool_or(has_function_privilege(role,
    'public.advance_draw_event_unrestricted(uuid,uuid,text,integer,integer[])', 'execute')) as allowed
    from unnest(array['anon','authenticated','service_role']) role`);
  assert.equal(result.allowed, false);
});

test("disabling the limit on one session does not affect another session", async () => {
  await unlimited();
  await db.exec(`
    insert into events (id, status, prize_count) values ('${actor}', 'drawing', 2);
    insert into entries select '${actor}', n, 'other@example.invalid' from generate_series(1, 6) n;
    insert into audit_logs (action, entity_type, entity_id, payload)
      values ('draw.number_revealed', 'event', '${actor}', '{"number":1,"position":1}');
  `);
  const otherAdvance = number => query(
    "select advance_draw_event($1, $1, 'redraw', $2, array[1,2,3,4,5,6])", [actor, number]);
  await otherAdvance(1);
  await assert.rejects(otherAdvance(2), /ATTEMPT_LIMIT/);
  await advance(1);
  await advance(2);
});
