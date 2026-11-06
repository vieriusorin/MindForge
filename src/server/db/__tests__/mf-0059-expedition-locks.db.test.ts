/**
 * MF-0059 (T1, LOOP-PLAN "Riskiest step"): the expedition writers and their lock order. LOCAL stack
 * only (pnpm test:db).
 *
 * start_expedition, end_expedition and advance_group_course take the public.groups row
 * FOR NO KEY UPDATE before they touch expeditions. Each interleaving holds one side open in a
 * transaction (the superuser connection impersonating the admin), sends the other side through the
 * admin's Supabase client, and records two ordering witnesses before the commit:
 *   - settledBeforeCommit: the sent call had already returned (it must not have);
 *   - waitsOnGroupRow: the sent call waits on a tuple lock of public.groups, the first lock of the
 *     shared order, not on an expedition row further down.
 * (d) and (e) are refusals rather than locks: the stale-tab guard (40001) and "nothing running" (P0002).
 *
 * The fixture path is this file's own (`mf0059-locks-<run>`), written straight into
 * private.path_courses and removed afterwards, so it never depends on db:sync-keys.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PATH = `mf0059-locks-${RUN}`;
const FIRST = "ccdv-f";
const SECOND = "prod-prompting";
const THIRD = "team-onboarding-sample"; // so a second move from a stale tab would have somewhere to go
const TARGET = 10;
const WITNESS_WAIT_MS = 2000;

const db = sql(); // holds the open side
const probe = sql(); // reads the witnesses while `db` is inside a transaction

interface RpcResult {
  data: unknown;
  error: { code?: string; message: string } | null;
}

interface Interleaving<T> {
  held: T;
  sent: RpcResult;
  settledBeforeCommit: boolean;
  waitsOnGroupRow: boolean;
}

let ADMIN: TestUser;
let MEMBERS: TestUser[] = [];
let DOMAIN = ""; // a domain present in both FIRST and SECOND
let SKILL = ""; // a FIRST skill of DOMAIN

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

function codeOf(result: RpcResult): string {
  return result.error ? (result.error.code ?? result.error.message) : "ok";
}

function start(groupId: string): PromiseLike<RpcResult> {
  return ADMIN.client.rpc("start_expedition", {
    p_group_id: groupId,
    p_domain_code: DOMAIN,
    p_target: TARGET,
  });
}

function end(client: SupabaseClient, groupId: string): PromiseLike<RpcResult> {
  return client.rpc("end_expedition", { p_group_id: groupId });
}

async function waitsOnGroupRow(holderPid: number): Promise<boolean> {
  const [row] = await probe<{ waits: boolean }[]>`
    select exists (
      select 1 from pg_locks l
      where ${holderPid} = any(pg_blocking_pids(l.pid))
        and l.locktype = 'tuple'
        and l.relation = 'public.groups'::regclass
    ) as waits`;
  return row?.waits ?? false;
}

/**
 * Runs `hold` as the admin in an open transaction, sends `send` (a lazy builder: nothing goes out
 * until it is awaited), lets it run into whatever lock it meets, then commits.
 */
async function interleave<T>(
  hold: (tx: postgres.TransactionSql) => Promise<T>,
  send: () => PromiseLike<RpcResult>,
): Promise<Interleaving<T>> {
  let settled = false;
  let settledBeforeCommit = true;
  let waits = false;
  let pending: Promise<RpcResult> = Promise.resolve({
    data: null,
    error: null,
  });

  const held = await db.begin(async (tx) => {
    await tx.unsafe("set local role authenticated");
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: ADMIN.id, role: "authenticated" })}, true)`;
    const [me] = await tx<{ pid: number }[]>`select pg_backend_pid() as pid`;
    if (!me) throw new Error("no backend pid");
    const result = await hold(tx);

    pending = Promise.resolve(send()).then((r) => {
      settled = true;
      return r;
    });
    for (let waited = 0; waited < WITNESS_WAIT_MS && !waits; waited += 100) {
      await sleep(100);
      waits = await waitsOnGroupRow(me.pid);
    }
    settledBeforeCommit = settled;
    return result;
  });

  return {
    held: held as T,
    sent: await pending,
    settledBeforeCommit,
    waitsOnGroupRow: waits,
  };
}

async function createPathGroup(label: string): Promise<string> {
  const created = await ADMIN.client.rpc("create_path_group", {
    p_name: `MF-0059 locks ${label} ${RUN}`,
    p_path_slug: PATH,
  });
  if (created.error) throw created.error;
  const groupId = created.data as string;
  const [g] = await db<{ invite_code: string }[]>`
    select invite_code from public.groups where id = ${groupId}`;
  if (!g) throw new Error("no group");
  for (const m of MEMBERS) {
    const joined = await m.client.rpc("join_group", { p_code: g.invite_code });
    if (joined.error) throw joined.error;
  }
  return groupId;
}

async function packOf(groupId: string): Promise<string | undefined> {
  const [row] = await db<{ pack_slug: string }[]>`
    select pack_slug from public.groups where id = ${groupId}`;
  return row?.pack_slug;
}

async function openRows(groupId: string): Promise<number> {
  const [row] = await db<{ n: number }[]>`
    select count(*)::int as n from public.expeditions
    where group_id = ${groupId} and ends_at is null`;
  return row?.n ?? -1;
}

async function expeditionRow(
  id: string,
): Promise<{ starts_at: Date; ends_at: Date | null; pack_slug: string }> {
  const [row] = await db<
    { starts_at: Date; ends_at: Date | null; pack_slug: string }[]
  >`select starts_at, ends_at, pack_slug from public.expeditions where id = ${id}`;
  if (!row) throw new Error(`no expedition ${id}`);
  return row;
}

/** Closes whatever runs, then opens an expedition that has already reached its target. */
async function openReached(groupId: string, round: string): Promise<string> {
  await db`
    update public.expeditions set ends_at = clock_timestamp()
    where group_id = ${groupId} and ends_at is null`;
  const [row] = await db<{ id: string }[]>`
    insert into public.expeditions (group_id, domain_code, target, starts_at, ends_at, created_by)
    values (${groupId}, ${DOMAIN}, ${TARGET}, clock_timestamp(), null, ${ADMIN.id})
    returning id`;
  if (!row) throw new Error("no expedition");
  const ids = [ADMIN, ...MEMBERS].map((u) => u.id);
  await db`
    insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
    select (${ids}::uuid[])[1 + (i % 4)], ${FIRST}, ${SKILL},
           ${`${FIRST}.mf0059-locks-${RUN}.${round}-`} || i, array['a'], true, clock_timestamp()
    from generate_series(1, ${TARGET}) as i`;
  return row.id;
}

beforeAll(async () => {
  const [shared] = await db<{ domain_code: string; skill_code: string }[]>`
    select f.domain_code, min(f.skill_code) as skill_code
    from private.pack_skills f
    where f.pack_slug = ${FIRST}
      and exists (
        select 1 from private.pack_skills s
        where s.pack_slug = ${SECOND} and s.domain_code = f.domain_code
      )
    group by f.domain_code order by f.domain_code limit 1`;
  if (!shared)
    throw new Error(
      `no domain shared by ${FIRST} and ${SECOND}: the stack lacks synced keys (run pnpm db:sync-keys)`,
    );
  DOMAIN = shared.domain_code;
  SKILL = shared.skill_code;

  await db`
    insert into private.path_courses (path_slug, position, pack_slug)
    values (${PATH}, 1, ${FIRST}), (${PATH}, 2, ${SECOND}), (${PATH}, 3, ${THIRD})`;

  ADMIN = await createTestUser(`mf0059-locks-admin-${RUN}@test.local`);
  MEMBERS = await Promise.all(
    ["m2", "m3", "m4"].map((n) =>
      createTestUser(`mf0059-locks-${n}-${RUN}@test.local`),
    ),
  );
});

afterAll(async () => {
  const users = [ADMIN, ...MEMBERS].filter(Boolean);
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await db`delete from public.attempts where user_id in ${db(ids)}`;
    await db`
      delete from public.expeditions
      where group_id in (select id from public.groups where created_by in ${db(ids)})`;
    await db`delete from public.path_enrollments where user_id in ${db(ids)}`;
    await db`delete from public.groups where created_by in ${db(ids)}`;
  }
  await db`delete from private.path_courses where path_slug = ${PATH}`;
  for (const u of users) await deleteTestUser(u.id);
  await probe.end();
  await db.end();
});

describe("MF-0059 expedition writers: group row first", () => {
  it("(a) a start sent while a move holds the group waits for it, then starts in the NEW course", async () => {
    const group = await createPathGroup("a");
    const run = await interleave(
      async (tx) => {
        const [r] = await tx<{ next: string }[]>`
          select public.advance_group_course(${group}) as next`;
        return r?.next;
      },
      () => start(group),
    );

    expect(run.held).toBe(SECOND);
    expect.soft(run.waitsOnGroupRow, "waits on the group row").toBe(true);
    expect.soft(run.settledBeforeCommit, "settled before commit").toBe(false);
    expect(codeOf(run.sent)).toBe("ok");
    expect((await expeditionRow(run.sent.data as string)).pack_slug).toBe(
      SECOND,
    );
  });

  it("(b) two starts while a REACHED one runs: one opens, the other is 23P01 (never 40P01), the reached one closes at the new start", async () => {
    const group = await createPathGroup("b");

    // held round: the second start waits on the group row, not on the reached expedition's row
    const reached = await openReached(group, "held");
    const run = await interleave(
      async (tx) => {
        const [r] = await tx<{ id: string }[]>`
          select public.start_expedition(${group}, ${DOMAIN}, ${TARGET}) as id`;
        return r?.id;
      },
      () => start(group),
    );
    expect.soft(run.waitsOnGroupRow, "waits on the group row").toBe(true);
    expect.soft(run.settledBeforeCommit, "settled before commit").toBe(false);
    expect(codeOf(run.sent)).toBe("23P01");
    const fresh = await expeditionRow(String(run.held));
    expect((await expeditionRow(reached)).ends_at?.getTime()).toBe(
      fresh.starts_at.getTime(),
    );
    expect(fresh.ends_at).toBeNull();
    expect(await openRows(group)).toBe(1);

    // five rounds sent together, as two tabs would
    for (let round = 1; round <= 5; round++) {
      const old = await openReached(group, `r${round}`);
      const results = await Promise.all([start(group), start(group)]);
      expect(results.map(codeOf).sort(), `round ${round}`).toEqual([
        "23P01",
        "ok",
      ]);
      const winner = results.find((r) => r.error === null);
      const opened = await expeditionRow(String(winner?.data));
      expect((await expeditionRow(old)).ends_at?.getTime()).toBe(
        opened.starts_at.getTime(),
      );
      expect(await openRows(group)).toBe(1);
    }
  });

  it("(c) an end sent while a move holds the group waits for it, then finds nothing running (P0002); the move's time stays", async () => {
    const group = await createPathGroup("c");
    const [open] = await db<{ id: string }[]>`
      insert into public.expeditions (group_id, domain_code, target, starts_at, ends_at, created_by)
      values (${group}, ${DOMAIN}, ${TARGET}, now() - interval '1 hour', null, ${ADMIN.id})
      returning id`;
    if (!open) throw new Error("no expedition");

    const run = await interleave(
      async (tx) => {
        await tx`select public.advance_group_course(${group})`;
        // Review fix 1: the close time is clock_timestamp() after the lock, not now(); read what
        // the move wrote, as the superuser (expeditions has no policy for authenticated).
        await tx.unsafe("reset role");
        const [r] = await tx<{ at: Date }[]>`
          select ends_at as at from public.expeditions where id = ${open.id}`;
        return r?.at;
      },
      () => end(ADMIN.client, group),
    );

    expect.soft(run.waitsOnGroupRow, "waits on the group row").toBe(true);
    expect.soft(run.settledBeforeCommit, "settled before commit").toBe(false);
    expect(codeOf(run.sent)).toBe("P0002");
    expect((await expeditionRow(open.id)).ends_at?.getTime()).toBe(
      (run.held as Date).getTime(),
    );
    expect(await packOf(group)).toBe(SECOND);
  });

  it("(d) a stale tab or a double click moves one course, not two: the repeat is 40001", async () => {
    const group = await createPathGroup("d");
    const advanceFromFirst = (): PromiseLike<RpcResult> =>
      ADMIN.client.rpc("advance_group_course", {
        p_group_id: group,
        p_from_pack: FIRST,
      });

    const first = await advanceFromFirst();
    expect(codeOf(first)).toBe("ok");
    expect(first.data).toBe(SECOND);

    expect.soft(codeOf(await advanceFromFirst())).toBe("40001");
    expect(await packOf(group)).toBe(SECOND);
  });

  it("(e) an end with nothing running is P0002 and changes no row", async () => {
    const group = await createPathGroup("e");
    expect(codeOf(await end(ADMIN.client, group))).toBe("P0002");

    const [closed] = await db<{ id: string; ends_at: Date }[]>`
      insert into public.expeditions (group_id, domain_code, target, starts_at, ends_at, created_by)
      values (${group}, ${DOMAIN}, ${TARGET}, now() - interval '2 hours', now() - interval '1 hour', ${ADMIN.id})
      returning id, ends_at`;
    if (!closed) throw new Error("no expedition");

    expect(codeOf(await end(ADMIN.client, group))).toBe("P0002");
    expect((await expeditionRow(closed.id)).ends_at?.getTime()).toBe(
      closed.ends_at.getTime(),
    );
    expect(await openRows(group)).toBe(0);
  });
});
