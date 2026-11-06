/**
 * MF-0058 acceptance (SC-5, DB half). LOCAL stack only (pnpm test:db).
 * - `public.course_completions`: `authenticated` can't insert, update or delete it (its own rows
 *   included) and can't read another user's rows; it reads its own.
 * - `public.path_enrollments`: own rows only for select, insert and delete.
 * - `startPath` twice is ok with one row; `leavePath` removes it and leaves completions untouched.
 * The actions run for real behind their facades (auth, the per-request Supabase client = the
 * learner's signed-in client). Literals from .planning/tasks/MF-0058/GOAL.md (SC-5, Constraints).
 * Both tables are new in this ticket: until the migration lands every case fails on the missing
 * relation, and the teardown tolerates that. The importer half of SC-5 is in
 * src/server/paths/__tests__/mf-0058-recorder-wiring.acceptance.test.ts.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const { current } = vi.hoisted(() => ({
  current: { user: null as null | { id: string; client: unknown } },
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("next/cache", () => ({
  refresh: vi.fn(),
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  updateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () =>
    current.user ? { id: current.user.id, email: null } : null,
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => current.user?.client,
}));

const { startPath, leavePath } = await import("@/features/paths/actions");

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PATH = "claude-developer";
const OTHER_PATH = "mf0058-other-path";
const COMPLETED_AT = "2026-10-20T09:00:00.000Z";
const db = sql();
let A: TestUser;
let B: TestUser;

async function tableExists(name: string): Promise<boolean> {
  const [row] = await db<{ ok: boolean }[]>`
    select to_regclass(${name}) is not null as ok`;
  return row?.ok === true;
}

async function completionsOf(userId: string) {
  return db<{ pack_slug: string; pack_version: number; completed_at: Date }[]>`
    select pack_slug, pack_version, completed_at from public.course_completions
    where user_id = ${userId} order by pack_slug`;
}

async function enrollmentsOf(userId: string) {
  return db<{ path_slug: string }[]>`
    select path_slug from public.path_enrollments
    where user_id = ${userId} order by path_slug`;
}

/** A's recorded completion, written the way the recorder would (as a privileged role). */
async function seedCompletion(userId: string, packSlug: string) {
  await db`
    insert into public.course_completions (user_id, pack_slug, completed_at, pack_version)
    values (${userId}, ${packSlug}, ${COMPLETED_AT}, 1)
    on conflict do nothing`;
}

async function clearRows(): Promise<void> {
  const ids = [A?.id, B?.id].filter((id): id is string => Boolean(id));
  if (ids.length === 0) return;
  if (await tableExists("public.course_completions"))
    await db`delete from public.course_completions where user_id in ${db(ids)}`;
  if (await tableExists("public.path_enrollments"))
    await db`delete from public.path_enrollments where user_id in ${db(ids)}`;
}

beforeAll(async () => {
  A = await createTestUser(`mf0058-a-${RUN}@test.local`);
  B = await createTestUser(`mf0058-b-${RUN}@test.local`);
});

afterAll(async () => {
  // child rows first (they reference the users), then the users
  await clearRows();
  for (const u of [A, B]) if (u) await deleteTestUser(u.id);
  await db.end();
});

describe("MF-0058 SC-5: course_completions is read-own, written by the server only", () => {
  it("SC-5: RLS on; authenticated may select only; anon and PUBLIC have nothing", async () => {
    const [row] = await db<Record<string, boolean>[]>`
      select
        (select relrowsecurity from pg_class where oid = 'public.course_completions'::regclass) as rls_on,
        has_table_privilege('authenticated', 'public.course_completions', 'select') as auth_select,
        has_table_privilege('authenticated', 'public.course_completions', 'insert') as auth_insert,
        has_table_privilege('authenticated', 'public.course_completions', 'update') as auth_update,
        has_table_privilege('authenticated', 'public.course_completions', 'delete') as auth_delete,
        has_table_privilege('authenticated', 'public.course_completions', 'truncate') as auth_truncate,
        has_table_privilege('anon', 'public.course_completions', 'select,insert,update,delete,truncate') as anon_any,
        has_table_privilege('public', 'public.course_completions', 'select,insert,update,delete,truncate') as public_any`;
    expect(row).toEqual({
      rls_on: true,
      auth_select: true,
      auth_insert: false,
      auth_update: false,
      auth_delete: false,
      auth_truncate: false,
      anon_any: false,
      public_any: false,
    });
  });

  it("SC-5: a learner can't insert a completion, not even their own", async () => {
    await clearRows();
    const res = await A.client.from("course_completions").insert({
      user_id: A.id,
      pack_slug: "subagents",
      completed_at: COMPLETED_AT,
      pack_version: 1,
    });
    expect(res.error).not.toBeNull();
    expect(await completionsOf(A.id)).toEqual([]);
  });

  it("SC-5: a learner can't update or delete their own completion", async () => {
    await clearRows();
    await seedCompletion(A.id, "subagents");
    const before = await completionsOf(A.id);
    expect(before).toHaveLength(1);

    await A.client
      .from("course_completions")
      .update({ completed_at: "2020-01-01T00:00:00.000Z", pack_version: 99 })
      .eq("user_id", A.id);
    await A.client.from("course_completions").delete().eq("user_id", A.id);

    expect(await completionsOf(A.id)).toEqual(before);
  });

  it("SC-5: a learner reads their own completions and none of another user's", async () => {
    await clearRows();
    await seedCompletion(A.id, "subagents");

    const own = await A.client
      .from("course_completions")
      .select("pack_slug, pack_version");
    expect(own.error).toBeNull();
    expect(own.data).toEqual([{ pack_slug: "subagents", pack_version: 1 }]);

    const theirs = await B.client
      .from("course_completions")
      .select("pack_slug")
      .eq("user_id", A.id);
    expect(theirs.error).toBeNull();
    expect(theirs.data).toEqual([]);
  });
});

describe("MF-0058 SC-5: path_enrollments is own rows only", () => {
  it("SC-5: RLS on; authenticated may select, insert, delete; no update; anon and PUBLIC have nothing", async () => {
    const [row] = await db<Record<string, boolean>[]>`
      select
        (select relrowsecurity from pg_class where oid = 'public.path_enrollments'::regclass) as rls_on,
        has_table_privilege('authenticated', 'public.path_enrollments', 'select') as auth_select,
        has_table_privilege('authenticated', 'public.path_enrollments', 'insert') as auth_insert,
        has_table_privilege('authenticated', 'public.path_enrollments', 'delete') as auth_delete,
        has_table_privilege('authenticated', 'public.path_enrollments', 'truncate') as auth_truncate,
        has_table_privilege('anon', 'public.path_enrollments', 'select,insert,update,delete,truncate') as anon_any,
        has_table_privilege('public', 'public.path_enrollments', 'select,insert,update,delete,truncate') as public_any`;
    expect(row).toEqual({
      rls_on: true,
      auth_select: true,
      auth_insert: true,
      auth_delete: true,
      auth_truncate: false,
      anon_any: false,
      public_any: false,
    });
  });

  it("SC-5: a learner enrolls themself and can't enroll someone else", async () => {
    await clearRows();
    const own = await A.client
      .from("path_enrollments")
      .insert({ user_id: A.id, path_slug: PATH });
    expect(own.error).toBeNull();
    expect(await enrollmentsOf(A.id)).toEqual([{ path_slug: PATH }]);

    const forged = await A.client
      .from("path_enrollments")
      .insert({ user_id: B.id, path_slug: OTHER_PATH });
    expect(forged.error).not.toBeNull();
    expect(await enrollmentsOf(B.id)).toEqual([]);
  });

  it("SC-5: a learner sees only their own enrollments and can't delete another's", async () => {
    await clearRows();
    await A.client
      .from("path_enrollments")
      .insert({ user_id: A.id, path_slug: PATH });

    const seen = await B.client.from("path_enrollments").select("user_id");
    expect(seen.error).toBeNull();
    expect(seen.data).toEqual([]);

    await B.client.from("path_enrollments").delete().eq("user_id", A.id);
    expect(await enrollmentsOf(A.id)).toEqual([{ path_slug: PATH }]);

    const leave = await A.client
      .from("path_enrollments")
      .delete()
      .eq("user_id", A.id);
    expect(leave.error).toBeNull();
    expect(await enrollmentsOf(A.id)).toEqual([]);
  });
});

describe("MF-0058 SC-5: startPath / leavePath", () => {
  it("SC-5: startPath twice is ok both times and leaves one enrollment row", async () => {
    await clearRows();
    current.user = A;
    const first = await startPath({ pathSlug: PATH });
    const second = await startPath({ pathSlug: PATH });
    expect(first).toMatchObject({ ok: true });
    expect(second).toMatchObject({ ok: true });
    expect(await enrollmentsOf(A.id)).toEqual([{ path_slug: PATH }]);
  });

  it("SC-5: leavePath removes the enrollment and leaves the completions untouched", async () => {
    await clearRows();
    current.user = A;
    await seedCompletion(A.id, "ai-capabilities");
    await seedCompletion(A.id, "subagents");
    const completions = await completionsOf(A.id);
    expect(completions).toHaveLength(2);

    expect(await startPath({ pathSlug: PATH })).toMatchObject({ ok: true });
    expect(await leavePath({ pathSlug: PATH })).toMatchObject({ ok: true });

    expect(await enrollmentsOf(A.id)).toEqual([]);
    expect(await completionsOf(A.id)).toEqual(completions);
  });

  it("SC-5: leavePath touches only the signed-in learner's enrollment", async () => {
    await clearRows();
    current.user = B;
    expect(await startPath({ pathSlug: PATH })).toMatchObject({ ok: true });
    current.user = A;
    expect(await leavePath({ pathSlug: PATH })).toMatchObject({ ok: true });
    expect(await enrollmentsOf(B.id)).toEqual([{ path_slug: PATH }]);
  });
});
