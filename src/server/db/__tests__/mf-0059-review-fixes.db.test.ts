/**
 * MF-0059 review fixes (REVIEW.md should-fix 1 and 2). LOCAL stack only (pnpm test:db).
 *
 * (f) lock case: an end or a move whose transaction BEGAN before a concurrent start, but got the group
 *     row after the start committed, closes that start's row. Its close time must be taken after the
 *     lock (clock_timestamp), not the transaction's now(), or ends_at < starts_at (23514).
 * (g) a move onto a next course whose pack is not in private.packs is refused (P0001); the group's
 *     pack is unchanged, so "a group's pack is registered" (MF-0004) keeps holding.
 *
 * The fixture paths are this file's own, written straight into private.path_courses and removed
 * afterwards.
 */
import type postgres from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PATH = `mf0059-fix-${RUN}`;
const GHOST_PATH = `mf0059-ghost-path-${RUN}`;
const GHOST_PACK = `mf0059-ghost-pack-${RUN}`; // well-formed slug, never in private.packs
const FIRST = "ccdv-f";
const SECOND = "prod-prompting";
const TARGET = 10;
const WITNESS_WAIT_MS = 2000;

const db = sql(); // setup and reads
const probe = sql(); // reads the lock witness
const early = sql(); // the end/move that begins first
const late = sql(); // the start that begins second and locks first

let ADMIN: TestUser;
let MEMBERS: TestUser[] = [];
let DOMAIN = "";

const sleep = (ms: number): Promise<void> =>
  new Promise((done) => setTimeout(done, ms));

interface Gate<T> {
  promise: Promise<T>;
  open: (value: T) => void;
}

function gate<T>(): Gate<T> {
  let open: (value: T) => void = () => {};
  const promise = new Promise<T>((resolve) => {
    open = resolve;
  });
  return { promise, open };
}

async function actAsAdmin(tx: postgres.TransactionSql): Promise<void> {
  await tx.unsafe("set local role authenticated");
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: ADMIN.id, role: "authenticated" })}, true)`;
}

async function waitsOnGroupRow(
  waiterPid: number,
  holderPid: number,
): Promise<boolean> {
  const [row] = await probe<{ waits: boolean }[]>`
    select exists (
      select 1 from pg_locks l
      where l.pid = ${waiterPid}
        and ${holderPid} = any(pg_blocking_pids(l.pid))
        and l.locktype = 'tuple'
        and l.relation = 'public.groups'::regclass
    ) as waits`;
  return row?.waits ?? false;
}

async function createPathGroup(label: string, path: string): Promise<string> {
  const created = await ADMIN.client.rpc("create_path_group", {
    p_name: `MF-0059 fix ${label} ${RUN}`,
    p_path_slug: path,
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

interface EarlyRun {
  outcome: string;
  startedId: string;
  earlyNow: Date;
  waited: boolean;
}

/**
 * `early` begins and fixes its now(); then `late` begins, starts an expedition (holding the group
 * row); `early` sends `call` and must wait on the group row; `late` commits; `early` finishes.
 */
async function earlyThenLateStart(
  groupId: string,
  call: (tx: postgres.TransactionSql) => Promise<unknown>,
): Promise<EarlyRun> {
  const began = gate<{ at: Date; pid: number }>();
  const go = gate<undefined>();

  const earlyRun = early
    .begin(async (tx) => {
      await actAsAdmin(tx);
      const [r] = await tx<{ at: Date; pid: number }[]>`
        select now() as at, pg_backend_pid() as pid`;
      if (!r) throw new Error("no early row");
      began.open(r);
      await go.promise;
      await call(tx);
      return "ok";
    })
    .catch((error: { code?: string; message: string }) =>
      String(error.code ?? error.message),
    );

  const earlyInfo = await began.promise;
  await sleep(50); // the start's now() is strictly later than early's

  let waited = false;
  const startedId = await late.begin(async (tx) => {
    await actAsAdmin(tx);
    const [r] = await tx<{ id: string; pid: number }[]>`
      select public.start_expedition(${groupId}, ${DOMAIN}, ${TARGET}) as id,
             pg_backend_pid() as pid`;
    if (!r) throw new Error("no start");
    go.open(undefined);
    for (let w = 0; w < WITNESS_WAIT_MS && !waited; w += 100) {
      await sleep(100);
      waited = await waitsOnGroupRow(earlyInfo.pid, r.pid);
    }
    return r.id;
  });

  return {
    outcome: await earlyRun,
    startedId,
    earlyNow: earlyInfo.at,
    waited,
  };
}

async function expeditionRow(
  id: string,
): Promise<{ starts_at: Date; ends_at: Date | null }> {
  const [row] = await db<{ starts_at: Date; ends_at: Date | null }[]>`
    select starts_at, ends_at from public.expeditions where id = ${id}`;
  if (!row) throw new Error(`no expedition ${id}`);
  return row;
}

beforeAll(async () => {
  const [d] = await db<{ domain_code: string }[]>`
    select f.domain_code from private.pack_skills f
    where f.pack_slug = ${FIRST}
    order by f.domain_code limit 1`;
  if (!d)
    throw new Error(
      `no domain in ${FIRST}: the stack lacks synced keys (run pnpm db:sync-keys)`,
    );
  DOMAIN = d.domain_code;

  const [ghost] = await db<{ n: number }[]>`
    select count(*)::int as n from private.packs where slug = ${GHOST_PACK}`;
  if (ghost?.n !== 0) throw new Error(`${GHOST_PACK} is registered`);

  await db`
    insert into private.path_courses (path_slug, position, pack_slug)
    values (${PATH}, 1, ${FIRST}), (${PATH}, 2, ${SECOND}),
           (${GHOST_PATH}, 1, ${FIRST}), (${GHOST_PATH}, 2, ${GHOST_PACK})`;

  ADMIN = await createTestUser(`mf0059-fix-admin-${RUN}@test.local`);
  MEMBERS = await Promise.all(
    ["m2", "m3", "m4"].map((n) =>
      createTestUser(`mf0059-fix-${n}-${RUN}@test.local`),
    ),
  );
});

afterAll(async () => {
  const users = [ADMIN, ...MEMBERS].filter(Boolean);
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await db`
      delete from public.expeditions
      where group_id in (select id from public.groups where created_by in ${db(ids)})`;
    await db`delete from public.path_enrollments where user_id in ${db(ids)}`;
    await db`delete from public.groups where created_by in ${db(ids)}`;
  }
  await db`delete from private.path_courses where path_slug in (${PATH}, ${GHOST_PATH})`;
  for (const u of users) await deleteTestUser(u.id);
  await Promise.all([probe.end(), early.end(), late.end(), db.end()]);
});

describe("MF-0059 review fix 1: close time is taken after the group lock", () => {
  it("(f1) an end that began before a concurrent start, but locked after it, ends that start with ends_at >= starts_at", async () => {
    const group = await createPathGroup("f1", PATH);
    const run = await earlyThenLateStart(
      group,
      (tx) => tx`select public.end_expedition(${group})`,
    );

    expect.soft(run.waited, "early waits on the group row").toBe(true);
    expect(run.outcome).toBe("ok");
    const row = await expeditionRow(run.startedId);
    expect(row.starts_at.getTime()).toBeGreaterThan(run.earlyNow.getTime());
    expect(row.ends_at).not.toBeNull();
    expect(row.ends_at?.getTime()).toBeGreaterThanOrEqual(
      row.starts_at.getTime(),
    );
  });

  it("(f2) a move that began before a concurrent start, but locked after it, moves and ends that start with ends_at >= starts_at", async () => {
    const group = await createPathGroup("f2", PATH);
    const run = await earlyThenLateStart(
      group,
      (tx) => tx`select public.advance_group_course(${group})`,
    );

    expect.soft(run.waited, "early waits on the group row").toBe(true);
    expect(run.outcome).toBe("ok");
    expect(await packOf(group)).toBe(SECOND);
    const row = await expeditionRow(run.startedId);
    expect(row.ends_at).not.toBeNull();
    expect(row.ends_at?.getTime()).toBeGreaterThanOrEqual(
      row.starts_at.getTime(),
    );
  });
});

describe("MF-0059 review fix 2: no move onto an unregistered pack", () => {
  it("(g) the next course's pack is not in private.packs: P0001, the group's pack is unchanged", async () => {
    const group = await createPathGroup("g", GHOST_PATH);
    const moved = await ADMIN.client.rpc("advance_group_course", {
      p_group_id: group,
      p_from_pack: FIRST,
    });
    expect(moved.error?.code ?? "ok").toBe("P0001");
    expect(await packOf(group)).toBe(FIRST);
  });
});
