/**
 * MF-0059 acceptance (DB): groups follow a path. LOCAL stack only (pnpm test:db).
 * - SC-1: `pnpm db:sync-keys` writes `private.path_courses` (path_slug, position, pack_slug) from
 *   `paths/*.yaml`; clients can't read it; a second run leaves the same rows.
 * - SC-2: `create_path_group(p_name, p_path_slug)` starts the group on the path's first course, makes
 *   the caller admin and enrolls them; unknown path → 22023; shares create_group's cap of 10 (54000).
 * - SC-3: `join_group` enrolls a new member of a path group (only on a new membership); pack-only
 *   groups enroll no one; an existing enrollment keeps its started_at.
 * - SC-4: `advance_group_course(p_group_id)`: admin only (42501), one step forward along the path
 *   registry, refused for pack-only groups, at the last course and when the pack left the path.
 * - SC-5: `group_invite_preview(p_code)`: name + path_slug only, to a signed-in caller; anon can't.
 * - SC-9 (C-1): a move ends the running (open) expedition at the move time; its progress stays in
 *   its own pack; a new one can start in the new course; `expedition_pack` names the old pack to
 *   members. Nothing here asserts a window length (user, "Expeditions at your own pace").
 * - SC-10 (own pace): a start is open (`ends_at` null) and a recall 30 days later counts;
 *   `end_expedition(p_group_id)` is admin only (42501), sets ends_at and freezes progress; a start
 *   while an unreached one runs → 23P01; while a reached one runs → the old one closes at the start
 *   time and the new one is open.
 * Literals from .planning/tasks/MF-0059/GOAL.md. The new functions, columns and table don't exist
 * before this ticket's migration, so the red is a runtime error; the teardown tolerates that.
 * Each describe has its own fixture, so one missing function does not mask another SC.
 */
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const ROOT = resolve(import.meta.dirname, "../../../..");
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PATH = "claude-developer";
const PATH_COURSES = [
  "ai-capabilities",
  "platform-foundations",
  "claude-code-in-action",
  "agent-skills",
  "subagents",
] as const;
const FIRST = "ai-capabilities";
const SECOND = "platform-foundations";
const PACK_ONLY = "ccdv-f"; // a registered pack that is no course of the path
const OFF_PATH = "prod-prompting"; // registered, not in claude-developer (C-3 fixture)
const CAP = 10;
const PREVIEW_FN = "public.group_invite_preview(text)";

const db = sql();
const users: TestUser[] = [];

async function newUser(tag: string): Promise<TestUser> {
  const u = await createTestUser(`mf0059-${tag}-${RUN}@test.local`);
  users.push(u);
  return u;
}

const name = (label: string): string => `MF-0059 ${label} ${RUN}`;

/** "ok" on success, else the Postgres / PostgREST error code. */
async function code(
  promise: PromiseLike<{ error: { code?: string; message: string } | null }>,
): Promise<string> {
  const { error } = await promise;
  return error ? (error.code ?? error.message) : "ok";
}

function runSync(): void {
  // The real packs/ and paths/ on the local stack: no fixture packs dir, never a remote DB.
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.MINDFORGE_PACKS_DIR;
  delete env.SUPABASE_DB_URL;
  const run = spawnSync(
    process.execPath,
    [join(ROOT, "scripts", "sync-question-keys.mjs")],
    { cwd: ROOT, env, encoding: "utf8" },
  );
  if (run.status !== 0) throw new Error(`sync failed:\n${run.stderr}`);
}

async function createPathGroup(
  admin: TestUser,
  label: string,
  pathSlug = PATH,
): Promise<string> {
  const created = await admin.client.rpc("create_path_group", {
    p_name: name(label),
    p_path_slug: pathSlug,
  });
  if (created.error) throw created.error;
  return created.data as string;
}

async function createPackGroup(
  admin: TestUser,
  label: string,
): Promise<string> {
  const created = await admin.client.rpc("create_group", {
    p_name: name(label),
    p_pack_slug: PACK_ONLY,
  });
  if (created.error) throw created.error;
  return created.data as string;
}

async function inviteCode(admin: TestUser, groupId: string): Promise<string> {
  const { data, error } = await admin.client
    .from("groups")
    .select("invite_code")
    .eq("id", groupId)
    .single();
  if (error) throw error;
  return data.invite_code as string;
}

function joinGroup(client: SupabaseClient, inviteCodeValue: string) {
  return client.rpc("join_group", { p_code: inviteCodeValue });
}

async function joinAll(
  admin: TestUser,
  groupId: string,
  members: readonly TestUser[],
): Promise<void> {
  const codeValue = await inviteCode(admin, groupId);
  for (const m of members) {
    const joined = await joinGroup(m.client, codeValue);
    if (joined.error) throw joined.error;
  }
}

async function groupRow(
  groupId: string,
): Promise<{ pack_slug: string; path_slug: string | null } | undefined> {
  const [row] = await db<{ pack_slug: string; path_slug: string | null }[]>`
    select pack_slug, path_slug from public.groups where id = ${groupId}`;
  return row;
}

async function packOf(groupId: string): Promise<string | undefined> {
  const [row] = await db<{ pack_slug: string }[]>`
    select pack_slug from public.groups where id = ${groupId}`;
  return row?.pack_slug;
}

async function membershipsOf(
  userId: string,
  groupId: string,
): Promise<{ role: string }[]> {
  return db<{ role: string }[]>`
    select role from public.group_members
    where user_id = ${userId} and group_id = ${groupId}`;
}

async function enrollmentsOf(
  userId: string,
): Promise<{ path_slug: string; started_at: Date }[]> {
  return db<{ path_slug: string; started_at: Date }[]>`
    select path_slug, started_at from public.path_enrollments
    where user_id = ${userId} order by path_slug`;
}

async function registryRows(): Promise<
  { path_slug: string; position: number; pack_slug: string }[]
> {
  return db<{ path_slug: string; position: number; pack_slug: string }[]>`
    select path_slug, position, pack_slug from private.path_courses
    where path_slug = ${PATH} order by position`;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

async function dbNow(): Promise<Date> {
  const [row] = await db<{ now: Date }[]>`select clock_timestamp() as now`;
  if (!row) throw new Error("no clock");
  return row.now;
}

/** A correct, countable recall (unique question id, prefixed by its pack as MF-0024 requires). */
async function insertAttempt(
  user: TestUser,
  pack: string,
  skill: string,
  answeredAt: Date,
): Promise<void> {
  const questionId = `${pack}.mf0059-${RUN}.${Math.floor(Math.random() * 1e9)}`;
  await db`
    insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
    values (${user.id}, ${pack}, ${skill}, ${questionId}, ${["a"]}, true, ${answeredAt})`;
}

async function progressOf(
  client: SupabaseClient,
  expeditionId: string,
): Promise<unknown> {
  const { data, error } = await client.rpc("expedition_progress", {
    p_expedition_id: expeditionId,
  });
  if (error) throw error;
  return data;
}

async function expeditionRow(
  id: string,
): Promise<{ starts_at: Date; ends_at: Date | null } | undefined> {
  const [row] = await db<{ starts_at: Date; ends_at: Date | null }[]>`
    select starts_at, ends_at from public.expeditions where id = ${id}`;
  return row;
}

beforeAll(() => {
  // SC-1's first run; every other describe needs the registry rows it writes (C-4: no db:reset).
  runSync();
}, 120_000);

afterAll(async () => {
  // child-first, each step tolerant of objects this ticket has not created yet
  const ids = users.map((u) => u.id);
  if (ids.length > 0) {
    await db`delete from public.attempts where user_id in ${db(ids)}`;
    const [exp] = await db<{ ok: boolean }[]>`
      select to_regclass('public.expeditions') is not null as ok`;
    if (exp?.ok)
      await db`
        delete from public.expeditions
        where group_id in (select id from public.groups where created_by in ${db(ids)})`;
    await db`delete from public.path_enrollments where user_id in ${db(ids)}`;
    // memberships cascade from the groups
    await db`delete from public.groups where created_by in ${db(ids)}`;
  }
  for (const u of users) await deleteTestUser(u.id);
  await db.end();
});

describe("MF-0059 SC-1: the path registry", () => {
  it("SC-1: after db:sync-keys, claude-developer positions 1–5 are the five courses in path order", async () => {
    expect(await registryRows()).toEqual(
      PATH_COURSES.map((pack, i) => ({
        path_slug: PATH,
        position: i + 1,
        pack_slug: pack,
      })),
    );
  });

  it("SC-1: a second run leaves exactly the same 5 rows", async () => {
    const before = await registryRows();
    runSync();
    const after = await registryRows();
    expect(after).toHaveLength(5);
    expect(after).toEqual(before);
  }, 120_000);

  it("SC-1: RLS is on and neither authenticated nor anon holds any privilege on it", async () => {
    const [row] = await db<Record<string, boolean>[]>`
      select
        (select relrowsecurity from pg_class where oid = 'private.path_courses'::regclass) as rls_on,
        has_table_privilege('authenticated', 'private.path_courses', 'select,insert,update,delete,truncate') as auth_any,
        has_table_privilege('anon', 'private.path_courses', 'select,insert,update,delete,truncate') as anon_any`;
    expect(row).toEqual({ rls_on: true, auth_any: false, anon_any: false });
  });

  it("SC-1: a select as authenticated or as anon is a permission error (42501)", async () => {
    for (const role of ["authenticated", "anon"]) {
      const result = await db
        .begin(async (tx) => {
          await tx.unsafe(`set local role ${role}`);
          await tx`select path_slug from private.path_courses`;
          return "ok";
        })
        .catch((error: { code?: string }) => error.code ?? "error");
      expect(result, role).toBe("42501");
    }
  });
});

describe("MF-0059 SC-2: create_path_group", () => {
  let A: TestUser;
  let C: TestUser;

  beforeAll(async () => {
    A = await newUser("sc2-a");
    C = await newUser("sc2-cap");
  });

  it("SC-2: the group follows the path, starts on its first course, the caller is admin and enrolled", async () => {
    const created = await A.client.rpc("create_path_group", {
      p_name: name("sc2"),
      p_path_slug: PATH,
    });
    expect(created.error).toBeNull();
    const groupId = created.data as string;
    expect(await groupRow(groupId)).toEqual({
      pack_slug: FIRST,
      path_slug: PATH,
    });
    expect(await membershipsOf(A.id, groupId)).toEqual([{ role: "admin" }]);
    expect((await enrollmentsOf(A.id)).map((e) => e.path_slug)).toEqual([PATH]);
  });

  it("SC-2: an unknown path is refused with 22023 and makes no group", async () => {
    const before = await db<{ n: number }[]>`
      select count(*)::int as n from public.groups where created_by = ${A.id}`;
    expect(
      await code(
        A.client.rpc("create_path_group", {
          p_name: name("ghost"),
          p_path_slug: "mf0059-no-such-path",
        }),
      ),
    ).toBe("22023");
    const after = await db<{ n: number }[]>`
      select count(*)::int as n from public.groups where created_by = ${A.id}`;
    expect(after[0]?.n).toBe(before[0]?.n);
  });

  it("SC-2: it shares create_group's cap of 10 per creator: the 11th of either kind → 54000", async () => {
    for (let i = 1; i <= CAP; i++) {
      const result =
        i % 2 === 0
          ? C.client.rpc("create_group", {
              p_name: name(`cap ${i}`),
              p_pack_slug: PACK_ONLY,
            })
          : C.client.rpc("create_path_group", {
              p_name: name(`cap ${i}`),
              p_path_slug: PATH,
            });
      expect(await code(result), `group ${i}`).toBe("ok");
    }
    expect(
      await code(
        C.client.rpc("create_path_group", {
          p_name: name("cap 11 path"),
          p_path_slug: PATH,
        }),
      ),
    ).toBe("54000");
    expect(
      await code(
        C.client.rpc("create_group", {
          p_name: name("cap 11 pack"),
          p_pack_slug: PACK_ONLY,
        }),
      ),
    ).toBe("54000");
    const [n] = await db<{ n: number }[]>`
      select count(*)::int as n from public.groups where created_by = ${C.id}`;
    expect(n?.n).toBe(CAP);
  });
});

describe("MF-0059 SC-3: join_group enrolls a new member of a path group", () => {
  let ADMIN: TestUser;
  let J1: TestUser; // joins the path group
  let J2: TestUser; // joins the pack-only group
  let J3: TestUser; // enrolled before joining
  let PATH_GROUP = "";
  let PACK_GROUP = "";
  let PATH_CODE = "";
  let PACK_CODE = "";

  beforeAll(async () => {
    ADMIN = await newUser("sc3-admin");
    J1 = await newUser("sc3-j1");
    J2 = await newUser("sc3-j2");
    J3 = await newUser("sc3-j3");
    PACK_GROUP = await createPackGroup(ADMIN, "sc3 pack");
    PACK_CODE = await inviteCode(ADMIN, PACK_GROUP);
    PATH_GROUP = await createPathGroup(ADMIN, "sc3 path");
    PATH_CODE = await inviteCode(ADMIN, PATH_GROUP);
  });

  it("SC-3: joining a path group adds the member and a path_enrollments row for its path", async () => {
    expect(await code(joinGroup(J1.client, PATH_CODE))).toBe("ok");
    expect(await membershipsOf(J1.id, PATH_GROUP)).toEqual([
      { role: "member" },
    ]);
    expect((await enrollmentsOf(J1.id)).map((e) => e.path_slug)).toEqual([
      PATH,
    ]);
  });

  it("SC-3: joining a pack-only group adds the member and no enrollment", async () => {
    expect(await code(joinGroup(J2.client, PACK_CODE))).toBe("ok");
    expect(await membershipsOf(J2.id, PACK_GROUP)).toEqual([
      { role: "member" },
    ]);
    expect(await enrollmentsOf(J2.id)).toEqual([]);
  });

  it("SC-3: joining twice leaves one membership and one enrollment", async () => {
    expect(await code(joinGroup(J1.client, PATH_CODE))).toBe("ok");
    expect(await membershipsOf(J1.id, PATH_GROUP)).toHaveLength(1);
    expect((await enrollmentsOf(J1.id)).map((e) => e.path_slug)).toEqual([
      PATH,
    ]);
  });

  it("SC-3: joined, left the path, joins again: still not enrolled, still a member", async () => {
    expect((await enrollmentsOf(J1.id)).map((e) => e.path_slug)).toEqual([
      PATH,
    ]);
    const leave = await J1.client
      .from("path_enrollments")
      .delete()
      .eq("user_id", J1.id)
      .eq("path_slug", PATH);
    expect(leave.error).toBeNull();
    expect(await enrollmentsOf(J1.id)).toEqual([]);

    expect(await code(joinGroup(J1.client, PATH_CODE))).toBe("ok");
    expect(await enrollmentsOf(J1.id)).toEqual([]);
    expect(await membershipsOf(J1.id, PATH_GROUP)).toEqual([
      { role: "member" },
    ]);
  });

  it("SC-3: already enrolled before joining: started_at unchanged", async () => {
    const STARTED = "2026-10-01T08:00:00.000Z";
    const own = await J3.client
      .from("path_enrollments")
      .insert({ user_id: J3.id, path_slug: PATH });
    expect(own.error).toBeNull();
    await db`
      update public.path_enrollments set started_at = ${STARTED}
      where user_id = ${J3.id} and path_slug = ${PATH}`;

    expect(await code(joinGroup(J3.client, PATH_CODE))).toBe("ok");
    expect(await membershipsOf(J3.id, PATH_GROUP)).toEqual([
      { role: "member" },
    ]);
    const rows = await enrollmentsOf(J3.id);
    expect(rows.map((e) => e.path_slug)).toEqual([PATH]);
    expect(rows[0]?.started_at.toISOString()).toBe(STARTED);
  });
});

describe("MF-0059 SC-4: advance_group_course", () => {
  let ADMIN: TestUser;
  let MEMBER: TestUser;
  let PATH_GROUP = "";
  let PACK_GROUP = "";

  function advance(client: SupabaseClient, groupId: string) {
    return client.rpc("advance_group_course", { p_group_id: groupId });
  }

  beforeAll(async () => {
    ADMIN = await newUser("sc4-admin");
    MEMBER = await newUser("sc4-member");
    PACK_GROUP = await createPackGroup(ADMIN, "sc4 pack");
    PATH_GROUP = await createPathGroup(ADMIN, "sc4 path");
    await joinAll(ADMIN, PATH_GROUP, [MEMBER]);
  });

  it("SC-4: a non-admin member is refused with 42501; the pack is unchanged", async () => {
    expect(await code(advance(MEMBER.client, PATH_GROUP))).toBe("42501");
    expect(await packOf(PATH_GROUP)).toBe(FIRST);
  });

  it("SC-4: a pack-only group is refused; its pack is unchanged", async () => {
    expect(await code(advance(ADMIN.client, PACK_GROUP))).not.toBe("ok");
    expect(await packOf(PACK_GROUP)).toBe(PACK_ONLY);
  });

  it("SC-4: at position 1 the pack becomes position 2 (platform-foundations)", async () => {
    expect(await packOf(PATH_GROUP)).toBe(FIRST);
    expect(await code(advance(ADMIN.client, PATH_GROUP))).toBe("ok");
    expect(await groupRow(PATH_GROUP)).toEqual({
      pack_slug: SECOND,
      path_slug: PATH,
    });
  });

  it("SC-4: at position 4 (agent-skills) the pack becomes position 5 (subagents)", async () => {
    await db`update public.groups set pack_slug = 'agent-skills' where id = ${PATH_GROUP}`;
    expect(await code(advance(ADMIN.client, PATH_GROUP))).toBe("ok");
    expect(await packOf(PATH_GROUP)).toBe("subagents");
  });

  it("SC-4: at the last course (subagents, 5 of 5) it is refused; the pack is unchanged", async () => {
    await db`update public.groups set pack_slug = 'subagents' where id = ${PATH_GROUP}`;
    expect(await code(advance(ADMIN.client, PATH_GROUP))).not.toBe("ok");
    expect(await packOf(PATH_GROUP)).toBe("subagents");
  });

  it("SC-4: the group's current pack is not in the registry (path file changed): refused, pack unchanged", async () => {
    await db`update public.groups set pack_slug = ${OFF_PATH} where id = ${PATH_GROUP}`;
    expect(await code(advance(ADMIN.client, PATH_GROUP))).not.toBe("ok");
    expect(await packOf(PATH_GROUP)).toBe(OFF_PATH);
  });
});

describe("MF-0059 SC-5: group_invite_preview", () => {
  let ADMIN: TestUser;
  let X: TestUser; // signed in, not a member
  let PATH_CODE = "";
  let PACK_CODE = "";

  beforeAll(async () => {
    ADMIN = await newUser("sc5-admin");
    X = await newUser("sc5-x");
    PATH_CODE = await inviteCode(
      ADMIN,
      await createPathGroup(ADMIN, "sc5 path"),
    );
    PACK_CODE = await inviteCode(
      ADMIN,
      await createPackGroup(ADMIN, "sc5 pack"),
    );
  });

  it("SC-5: a signed-in non-member gets exactly the name and path_slug of a path group", async () => {
    const { data, error } = await X.client.rpc("group_invite_preview", {
      p_code: PATH_CODE,
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ name: name("sc5 path"), path_slug: PATH }]);
    expect(Object.keys(data?.[0] ?? {}).sort()).toEqual(["name", "path_slug"]);
  });

  it("SC-5: for a pack-only group path_slug is null, and nothing else is returned", async () => {
    const { data, error } = await X.client.rpc("group_invite_preview", {
      p_code: PACK_CODE,
    });
    expect(error).toBeNull();
    expect(data).toEqual([{ name: name("sc5 pack"), path_slug: null }]);
  });

  it("SC-5: an unknown code returns no row", async () => {
    const { data, error } = await X.client.rpc("group_invite_preview", {
      p_code: "mf0059-no-such-code",
    });
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("SC-5: anon has no execute: the call errors and the grant is absent", async () => {
    const anon = await anonClient().rpc("group_invite_preview", {
      p_code: PATH_CODE,
    });
    expect(anon.error).not.toBeNull();
    expect(anon.data ?? null).toBeNull();
    const [row] = await db<
      { exists: boolean; anon_exec: boolean; auth_exec: boolean }[]
    >`
      select to_regprocedure(${PREVIEW_FN}) is not null as exists,
             coalesce(has_function_privilege('anon', to_regprocedure(${PREVIEW_FN}), 'EXECUTE'), false) as anon_exec,
             coalesce(has_function_privilege('authenticated', to_regprocedure(${PREVIEW_FN}), 'EXECUTE'), false) as auth_exec`;
    expect(row).toEqual({ exists: true, anon_exec: false, auth_exec: true });
  });
});

describe("MF-0059 SC-9: moving the group ends its running expedition (C-1)", () => {
  let ADMIN: TestUser;
  let M2: TestUser;
  let M3: TestUser;
  let M4: TestUser;
  let X: TestUser; // signed in, not a member
  let GROUP = "";
  let EXPEDITION = "";
  let DOMAIN = ""; // a domain code present in BOTH the first and the second course
  let OLD_SKILL = ""; // a skill of DOMAIN in the first course
  let NEW_SKILL = ""; // a skill of DOMAIN in the second course
  let NEW_DOMAIN = ""; // any domain of the second course, for the new start
  let BEFORE_MOVE: Date;
  let AFTER_MOVE: Date;
  const OLD_RECALLS = 2; // correct, in window, in the old pack's domain, by members since joining

  const progress = (client: SupabaseClient): Promise<unknown> =>
    progressOf(client, EXPEDITION);

  beforeAll(async () => {
    const shared = await db<
      { domain_code: string; old_skill: string; new_skill: string }[]
    >`
      select o.domain_code, min(o.skill_code) as old_skill, min(n.skill_code) as new_skill
      from private.pack_skills o
      join private.pack_skills n on n.domain_code = o.domain_code and n.pack_slug = ${SECOND}
      where o.pack_slug = ${FIRST}
      group by o.domain_code order by o.domain_code limit 1`;
    const [newDomain] = await db<{ domain_code: string }[]>`
      select domain_code from private.pack_skills where pack_slug = ${SECOND}
      order by domain_code limit 1`;
    if (!shared[0] || !newDomain)
      throw new Error(
        `private.pack_skills lacks ${FIRST}/${SECOND} domains: the stack lacks synced keys (run pnpm db:sync-keys)`,
      );
    DOMAIN = shared[0].domain_code;
    OLD_SKILL = shared[0].old_skill;
    NEW_SKILL = shared[0].new_skill;
    NEW_DOMAIN = newDomain.domain_code;

    ADMIN = await newUser("sc9-admin");
    M2 = await newUser("sc9-m2");
    M3 = await newUser("sc9-m3");
    M4 = await newUser("sc9-m4");
    X = await newUser("sc9-x");
    GROUP = await createPathGroup(ADMIN, "sc9 path");
    await joinAll(ADMIN, GROUP, [M2, M3, M4]);

    const started = await ADMIN.client.rpc("start_expedition", {
      p_group_id: GROUP,
      p_domain_code: DOMAIN,
      p_target: 10,
    });
    if (started.error) throw started.error;
    EXPEDITION = started.data as string;

    // Deterministic past: everyone joined 2 days ago, the open expedition started 1 day ago.
    await db`
      update public.group_members set joined_at = now() - interval '2 days'
      where group_id = ${GROUP}`;
    await db`
      update public.expeditions set starts_at = now() - interval '1 day'
      where id = ${EXPEDITION}`;
    const now = await dbNow();
    const inWindow = new Date(now.getTime() - 12 * HOUR);
    // counts: the expedition's own pack and domain
    await insertAttempt(M2, FIRST, OLD_SKILL, inWindow);
    await insertAttempt(M3, FIRST, OLD_SKILL, inWindow);
    // never counts: the same domain CODE in the next course (domain codes repeat across packs)
    await insertAttempt(M4, SECOND, NEW_SKILL, inWindow);
  });

  it("SC-9: before the move the running expedition is open and counts its own pack's recalls (2)", async () => {
    expect((await expeditionRow(EXPEDITION))?.ends_at).toBeNull();
    expect(await progress(M2.client)).toBe(OLD_RECALLS);
  });

  it("SC-9: one advance call ends the running expedition at the move time and changes the pack", async () => {
    BEFORE_MOVE = await dbNow();
    expect(
      await code(
        ADMIN.client.rpc("advance_group_course", { p_group_id: GROUP }),
      ),
    ).toBe("ok");
    AFTER_MOVE = await dbNow();

    expect(await packOf(GROUP)).toBe(SECOND);
    const row = await expeditionRow(EXPEDITION);
    expect(row?.ends_at).not.toBeNull();
    const endsAt = row?.ends_at?.getTime() ?? Number.NaN;
    expect(endsAt).toBeGreaterThan(row?.starts_at.getTime() ?? Number.NaN);
    expect(endsAt).toBeGreaterThanOrEqual(BEFORE_MOVE.getTime() - 1000);
    expect(endsAt).toBeLessThanOrEqual(AFTER_MOVE.getTime());
  });

  it("SC-9: progress still counts only its own pack and domain in [starts_at, ends_at): a recall in the new course adds 0", async () => {
    expect(await progress(M2.client)).toBe(OLD_RECALLS);
    // a recall in the new course after the move
    await insertAttempt(M3, SECOND, NEW_SKILL, await dbNow());
    // and one in the old pack after the window closed
    await insertAttempt(M4, FIRST, OLD_SKILL, await dbNow());
    expect(await progress(M2.client)).toBe(OLD_RECALLS);
    expect(await progress(ADMIN.client)).toBe(OLD_RECALLS);
  });

  it("SC-9: the admin can start a new expedition in the new course right away", async () => {
    const started = await ADMIN.client.rpc("start_expedition", {
      p_group_id: GROUP,
      p_domain_code: NEW_DOMAIN,
      p_target: 10,
    });
    expect(started.error).toBeNull();
    expect(started.data).toMatch(/^[0-9a-f-]{36}$/);
    expect(started.data).not.toBe(EXPEDITION);
  });

  it("SC-9: expedition_pack returns the old pack to a member and refuses a non-member (42501)", async () => {
    for (const member of [ADMIN, M2]) {
      const { data, error } = await member.client.rpc("expedition_pack", {
        p_expedition_id: EXPEDITION,
      });
      expect(error).toBeNull();
      expect(data).toBe(FIRST);
    }
    expect(
      await code(
        X.client.rpc("expedition_pack", { p_expedition_id: EXPEDITION }),
      ),
    ).toBe("42501");
  });
});

describe("MF-0059 SC-10: expeditions at the group's own pace", () => {
  let ADMIN: TestUser;
  let M2: TestUser;
  let M3: TestUser;
  let M4: TestUser;
  let GROUP = "";
  let DOMAIN = ""; // a domain of the group's pack
  let SKILL = ""; // a skill of DOMAIN
  let FIRST_ID = ""; // started, then ended by the admin
  let SECOND_ID = ""; // started after the end, reaches its target
  const TARGET = 10; // the lowest target (MF-0017), so "reached" needs 10 recalls

  function start(): ReturnType<SupabaseClient["rpc"]> {
    return ADMIN.client.rpc("start_expedition", {
      p_group_id: GROUP,
      p_domain_code: DOMAIN,
      p_target: TARGET,
    });
  }

  function end(client: SupabaseClient): ReturnType<SupabaseClient["rpc"]> {
    return client.rpc("end_expedition", { p_group_id: GROUP });
  }

  beforeAll(async () => {
    const [skill] = await db<{ domain_code: string; skill_code: string }[]>`
      select domain_code, skill_code from private.pack_skills
      where pack_slug = ${PACK_ONLY} order by domain_code, skill_code limit 1`;
    if (!skill)
      throw new Error(
        `private.pack_skills has no ${PACK_ONLY} skills: the stack lacks synced keys (run pnpm db:sync-keys)`,
      );
    DOMAIN = skill.domain_code;
    SKILL = skill.skill_code;

    ADMIN = await newUser("sc10-admin");
    M2 = await newUser("sc10-m2");
    M3 = await newUser("sc10-m3");
    M4 = await newUser("sc10-m4");
    GROUP = await createPackGroup(ADMIN, "sc10 pace");
    await joinAll(ADMIN, GROUP, [M2, M3, M4]);
    // every member joined long before any recall below (MF-0017 tenure rule)
    await db`
      update public.group_members set joined_at = now() - interval '60 days'
      where group_id = ${GROUP}`;
  });

  it("SC-10: start_expedition makes an open expedition (ends_at null)", async () => {
    const started = await start();
    expect(started.error).toBeNull();
    FIRST_ID = started.data as string;
    expect(await expeditionRow(FIRST_ID)).toMatchObject({ ends_at: null });
  });

  it("SC-10: a recall 30 days after it started still counts", async () => {
    await db`
      update public.expeditions set starts_at = now() - interval '40 days'
      where id = ${FIRST_ID}`;
    const row = await expeditionRow(FIRST_ID);
    if (!row) throw new Error("no expedition row");
    await insertAttempt(
      M2,
      PACK_ONLY,
      SKILL,
      new Date(row.starts_at.getTime() + 30 * DAY),
    );
    expect(await progressOf(M2.client, FIRST_ID)).toBe(1);
  });

  it("SC-10: a start while an unreached one runs is refused (23P01)", async () => {
    expect(await code(start())).toBe("23P01");
    expect((await expeditionRow(FIRST_ID))?.ends_at).toBeNull();
  });

  it("SC-10: end_expedition by a plain member is refused (42501); it keeps running", async () => {
    expect(await code(end(M2.client))).toBe("42501");
    expect((await expeditionRow(FIRST_ID))?.ends_at).toBeNull();
  });

  it("SC-10: end_expedition by the admin sets ends_at (≤ now); progress is frozen at that point", async () => {
    expect(await code(end(ADMIN.client))).toBe("ok");
    const now = await dbNow();
    const row = await expeditionRow(FIRST_ID);
    expect(row?.ends_at).not.toBeNull();
    expect(row?.ends_at?.getTime()).toBeLessThanOrEqual(now.getTime());
    expect(row?.ends_at?.getTime()).toBeGreaterThan(
      row?.starts_at.getTime() ?? Number.NaN,
    );
    // a recall after the end adds 0
    await insertAttempt(M3, PACK_ONLY, SKILL, await dbNow());
    expect(await progressOf(ADMIN.client, FIRST_ID)).toBe(1);
  });

  it("SC-10: after the end a new start is allowed, and it is open", async () => {
    const started = await start();
    expect(started.error).toBeNull();
    SECOND_ID = started.data as string;
    expect(SECOND_ID).not.toBe(FIRST_ID);
    expect((await expeditionRow(SECOND_ID))?.ends_at).toBeNull();
  });

  it("SC-10: a start while a REACHED one runs closes the old one at the start time and opens the new one", async () => {
    // 10 countable correct recalls in the running expedition's domain: target reached
    for (const [i, member] of [ADMIN, M2, M3, M4].entries()) {
      for (let n = 0; n < (i < 2 ? 3 : 2); n++)
        await insertAttempt(member, PACK_ONLY, SKILL, await dbNow());
    }
    expect(await progressOf(M2.client, SECOND_ID)).toBe(TARGET);
    expect((await expeditionRow(SECOND_ID))?.ends_at).toBeNull();

    const started = await start();
    expect(started.error).toBeNull();
    const thirdId = started.data as string;
    const old = await expeditionRow(SECOND_ID);
    const fresh = await expeditionRow(thirdId);
    expect(old?.ends_at).not.toBeNull();
    expect(old?.ends_at?.getTime()).toBe(fresh?.starts_at.getTime());
    expect(fresh?.ends_at).toBeNull();
    // the closed one keeps its figure
    expect(await progressOf(M2.client, SECOND_ID)).toBe(TARGET);
  });
});
