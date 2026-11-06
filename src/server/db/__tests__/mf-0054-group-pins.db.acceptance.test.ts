/**
 * MF-0054 acceptance (frozen, DB half): pins are private, member-only and capped at 3 by the
 * database, for every writer. LOCAL stack only (pnpm test:db). The `it` blocks run in order and
 * share users and groups; each case clears A's pins first. Expected values are literals from
 * .planning/tasks/MF-0054/GOAL.md (SC-3, SC-4).
 */
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const db = sql();
let A: TestUser;
let B: TestUser;
let C: TestUser;
/** A's groups G[0]..G[5]; B joins G[0]. GC is C's, A is not in it. */
const G: string[] = [];
let GC = "";

async function createGroup(user: TestUser, name: string): Promise<string> {
  const { data, error } = await user.client.rpc("create_group", {
    p_name: name,
    p_pack_slug: "ccdv-f",
  });
  if (error || typeof data !== "string")
    throw new Error(`create_group: ${error?.message}`);
  return data;
}

/** A's pins as the database stores them, oldest first. Read as postgres (the table has no grants). */
async function pinsOf(
  userId: string,
): Promise<{ group_id: string; pinned_at: Date }[]> {
  return db<{ group_id: string; pinned_at: Date }[]>`
    select group_id, pinned_at from private.group_pins
    where user_id = ${userId} order by pinned_at, group_id`;
}

async function clearPins(userId: string): Promise<void> {
  await db`delete from private.group_pins where user_id = ${userId}`;
}

async function pin(user: TestUser, groupId: string) {
  return user.client.rpc("pin_group", { p_group_id: groupId });
}

/** Run `fn` as `userId` (auth.uid()) on its own connection, the way PostgREST would. */
async function asUser<T>(
  conn: ReturnType<typeof sql>,
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  const out = await conn.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  });
  return out as T;
}

beforeAll(async () => {
  A = await createTestUser(`mf0054-a-${RUN}@test.local`);
  B = await createTestUser(`mf0054-b-${RUN}@test.local`);
  C = await createTestUser(`mf0054-c-${RUN}@test.local`);
  for (let i = 1; i <= 6; i++) G.push(await createGroup(A, `MF-0054 G${i}`));
  GC = await createGroup(C, "MF-0054 C's group");
  const [g0] = await db<{ invite_code: string }[]>`
    select invite_code from public.groups where id = ${G[0] ?? ""}`;
  const joined = await B.client.rpc("join_group", {
    p_code: g0?.invite_code ?? "",
  });
  if (joined.error) throw new Error(`join_group: ${joined.error.message}`);
});

afterAll(async () => {
  // groups first (memberships and pins cascade), then users; tolerate a missing table
  const admin = adminClient();
  for (const id of [...G, GC].filter(Boolean))
    await admin.from("groups").delete().eq("id", id);
  for (const u of [A, B, C]) if (u) await deleteTestUser(u.id);
  await db.end();
});

describe("MF-0054 SC-3: pins are private and member-only", () => {
  it("no table privilege on private.group_pins for anon / authenticated / PUBLIC; anon executes no pin function", async () => {
    const [table] = await db<Record<string, boolean>[]>`
      select
        has_table_privilege('anon', 'private.group_pins', 'select,insert,update,delete,truncate') as anon_any,
        has_table_privilege('authenticated', 'private.group_pins', 'select,insert,update,delete,truncate') as auth_any,
        has_table_privilege('public', 'private.group_pins', 'select,insert,update,delete,truncate') as public_any,
        (select relrowsecurity from pg_class where oid = 'private.group_pins'::regclass) as rls_on`;
    expect(table).toEqual({
      anon_any: false,
      auth_any: false,
      public_any: false,
      rls_on: true,
    });

    const [fns] = await db<Record<string, boolean>[]>`
      select
        has_function_privilege('anon', 'public.pin_group(uuid)', 'execute') as anon_pin,
        has_function_privilege('anon', 'public.unpin_group(uuid)', 'execute') as anon_unpin,
        has_function_privilege('anon', 'public.list_my_pins()', 'execute') as anon_list,
        has_function_privilege('authenticated', 'public.pin_group(uuid)', 'execute') as auth_pin,
        has_function_privilege('authenticated', 'public.unpin_group(uuid)', 'execute') as auth_unpin,
        has_function_privilege('authenticated', 'public.list_my_pins()', 'execute') as auth_list,
        has_function_privilege('authenticated', 'private.pin_group_for(uuid, uuid)', 'execute') as auth_pin_for`;
    expect(fns).toEqual({
      anon_pin: false,
      anon_unpin: false,
      anon_list: false,
      auth_pin: true,
      auth_unpin: true,
      auth_list: true,
      auth_pin_for: false,
    });

    const anon = await anonClient().rpc("pin_group", { p_group_id: G[0] });
    expect(anon.error).not.toBeNull();
  });

  it("a member pins their group and sees it in list_my_pins", async () => {
    await clearPins(A.id);
    const res = await pin(A, G[0] ?? "");
    expect(res.error).toBeNull();
    expect(res.data).toEqual([]);

    const mine = await A.client.rpc("list_my_pins");
    expect(mine.error).toBeNull();
    expect(
      (mine.data as { group_id: string }[]).map((p) => p.group_id),
    ).toEqual([G[0]]);
  });

  it("pinning a group you are not in is refused (42501) and stores nothing", async () => {
    await clearPins(A.id);
    const res = await pin(A, GC);
    expect(res.error?.code).toBe("42501");
    expect(await pinsOf(A.id)).toEqual([]);
  });

  it("a co-member sees none of A's pins and cannot remove them", async () => {
    await clearPins(A.id);
    await pin(A, G[0] ?? "");

    const theirs = await B.client.rpc("list_my_pins");
    expect(theirs.error).toBeNull();
    expect(theirs.data).toEqual([]);

    const unpin = await B.client.rpc("unpin_group", { p_group_id: G[0] });
    expect(unpin.error).toBeNull();
    expect((await pinsOf(A.id)).map((p) => p.group_id)).toEqual([G[0]]);

    // no direct path to the table either, even inside the database as `authenticated`
    await expect(
      asUser(db, B.id, (tx) => tx`select * from private.group_pins`),
    ).rejects.toThrow(/permission denied/);
  });

  it("removing the membership removes the pin (cascade)", async () => {
    await clearPins(A.id);
    await pin(A, G[5] ?? "");
    expect((await pinsOf(A.id)).map((p) => p.group_id)).toEqual([G[5]]);
    await db`delete from public.group_members where group_id = ${G[5] ?? ""} and user_id = ${A.id}`;
    expect(await pinsOf(A.id)).toEqual([]);
  });

  it("unpinning removes the pin; unpinning a group that is not pinned succeeds", async () => {
    await clearPins(A.id);
    await pin(A, G[1] ?? "");
    const first = await A.client.rpc("unpin_group", { p_group_id: G[1] });
    expect(first.error).toBeNull();
    expect(await pinsOf(A.id)).toEqual([]);
    const again = await A.client.rpc("unpin_group", { p_group_id: G[1] });
    expect(again.error).toBeNull();
  });
});

describe("MF-0054 SC-4: at most 3 pins; a 4th replaces the oldest", () => {
  it("pinning G4 after G1 < G2 < G3 leaves {G2, G3, G4} and reports G1 as evicted", async () => {
    await clearPins(A.id);
    for (const g of [G[0], G[1], G[2]]) {
      const r = await pin(A, g ?? "");
      expect(r.error).toBeNull();
    }
    const fourth = await pin(A, G[3] ?? "");
    expect(fourth.error).toBeNull();
    expect(fourth.data).toEqual([
      { evicted_id: G[0], evicted_name: "MF-0054 G1" },
    ]);
    expect((await pinsOf(A.id)).map((p) => p.group_id)).toEqual([
      G[1],
      G[2],
      G[3],
    ]);
  });

  it("re-pinning an already-pinned group evicts nothing and keeps its pinned_at", async () => {
    const before = await pinsOf(A.id);
    const again = await pin(A, G[2] ?? "");
    expect(again.error).toBeNull();
    expect(again.data).toEqual([]);
    expect(await pinsOf(A.id)).toEqual(before);
  });

  it("two concurrent pins from one user end with exactly 3 pins; the second waited for the first's COMMIT", async () => {
    await clearPins(A.id);
    for (const g of [G[0], G[1], G[2]]) await pin(A, g ?? "");

    const events: string[] = [];
    let release: () => void = () => {};
    const held = new Promise<void>((r) => {
      release = r;
    });
    let firstPinned: () => void = () => {};
    const firstIsIn = new Promise<void>((r) => {
      firstPinned = r;
    });

    const c1 = sql();
    const c2 = sql();
    try {
      const one = asUser(c1, A.id, async (tx) => {
        await tx`select * from public.pin_group(${G[3] ?? ""}::uuid)`;
        events.push("c1-pinned");
        firstPinned();
        await held;
        events.push("c1-commit");
      });
      await firstIsIn;
      const two = asUser(c2, A.id, async (tx) => {
        await tx`select * from public.pin_group(${G[4] ?? ""}::uuid)`;
        events.push("c2-pinned");
      });
      await new Promise((r) => setTimeout(r, 400));
      // ordering witness: c2 is still waiting while c1's transaction is open
      expect(events).toEqual(["c1-pinned"]);
      release();
      await Promise.all([one, two]);
    } finally {
      await c1.end();
      await c2.end();
    }

    expect(events).toEqual(["c1-pinned", "c1-commit", "c2-pinned"]);
    expect((await pinsOf(A.id)).map((p) => p.group_id)).toEqual([
      G[2],
      G[3],
      G[4],
    ]);
  });
});
