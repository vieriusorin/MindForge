/**
 * MF-0017 acceptance (DB): Group Expedition. Only the group admin starts one, in a group of at least
 * 4 members, one at a time, with times set by the database (SC-1); progress is the count of
 * countable correct recalls by current members in the expedition's domain inside [starts_at,
 * ends_at), equal to `countableAttempts` over the same fixture (SC-2); non-members and anon read
 * nothing, and no member-callable path returns a per-member figure (SC-3).
 * Runs against the LOCAL stack (pnpm test:db). `it` blocks share the fixture in order.
 *
 * Contract (GOAL C-1, C-2 + coordinator 2026-11-05): `public.expeditions` has no privileges for
 * anon/authenticated; members read it only via `public.latest_expedition(uuid)`; writes only via
 * `public.start_expedition(uuid, text, integer)`; progress via `public.expedition_progress(uuid)`.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ReviewContext } from "@/engine/content";
import { emptyReviewContext } from "@/engine/content";
import type { Attempt } from "@/engine/memory";
import { countableAttempts } from "@/engine/memory";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "ccdv-f";
const OTHER_PACK = "team-onboarding-sample";
const PREFIX = `${PACK}.mf0017-${RUN}.`; // every question id this file writes (MF-0024: starts with its pack); teardown deletes by it
const HASH = "mf0017-hash";

const START_FN = "public.start_expedition(uuid,text,integer)";
const PROGRESS_FN = "public.expedition_progress(uuid)";
const LATEST_FN = "public.latest_expedition(uuid)";

// SC-2 window. The DB sets starts_at = now() on start; the test then moves the row to these fixed
// bounds with sql() so the fixture's attempt times are deterministic (still exactly 7 days).
const S = "2026-10-05T10:00:00.000Z";
const E = "2026-10-12T10:00:00.000Z";
const at = (iso: string, deltaMs: number): string =>
  new Date(new Date(iso).getTime() + deltaMs).toISOString();
const DAY = 24 * 60 * 60 * 1000;
const REVIEW_AT = at(S, 2 * DAY); // M3 reviews question qS here (spoils it for M3 only)
// Review B1 (user 2026-11-05): only recalls made after joining count, else a join reveals the
// joiner's own figure. Group G's members joined a day before the window; M2 joins mid-window.
const JOINED_AT: Readonly<Record<"A" | "M2" | "M3" | "M4", string>> = {
  A: at(S, -DAY),
  M2: at(S, 1.5 * DAY),
  M3: at(S, -DAY),
  M4: at(S, -DAY),
};

let A: TestUser; // creates the groups (admin)
let M2: TestUser;
let M3: TestUser;
let M4: TestUser;
let X: TestUser; // signed in, never a member
let G = ""; // 4 members: A, M2, M3, M4 (SC-1 start, SC-2 progress)
let R = ""; // 4 members: the race group
let SMALL = ""; // 3 members: A, M2, M3
let DOMAIN = ""; // a ccdv-f domain with at least 2 skills
let SKILL_1 = "";
let SKILL_2 = "";
let OTHER_SKILL = ""; // a ccdv-f skill of another domain
let FOREIGN_DOMAIN = ""; // a domain code of another pack only
let DOMAIN_SKILLS = new Set<string>();
let EXPEDITION_G = "";

type Who = "A" | "M2" | "M3" | "M4" | "X";
type SkillRef = "S1" | "S2" | "OTHER";
interface FixtureAttempt {
  who: Who;
  pack: "main" | "other";
  skill: SkillRef;
  q: string;
  correct: boolean;
  answeredAt: string;
  counts: boolean; // the edge-table verdict, by hand
}

const q = (name: string): string => `${PREFIX}${name}`;
const Q_REJECTED = q("rejected");
const Q_SPOILED = q("spoiled");

/** SC-2 fixture: each row pins one filter of the edge table. 7 rows count. */
const FIXTURE: readonly FixtureAttempt[] = [
  // counts: correct, in window, domain skill, current member, countable
  {
    who: "A",
    pack: "main",
    skill: "S1",
    q: q("q1"),
    correct: true,
    answeredAt: at(S, DAY),
    counts: true,
  },
  {
    who: "M2",
    pack: "main",
    skill: "S2",
    q: q("q2"),
    correct: true,
    answeredAt: at(S, 2 * DAY),
    counts: true,
  },
  {
    who: "M3",
    pack: "main",
    skill: "S1",
    q: q("q1"),
    correct: true,
    answeredAt: at(S, 3 * DAY),
    counts: true,
  },
  // at exactly starts_at: counts
  {
    who: "M4",
    pack: "main",
    skill: "S1",
    q: q("q3"),
    correct: true,
    answeredAt: S,
    counts: true,
  },
  // one second before ends_at: counts
  {
    who: "M2",
    pack: "main",
    skill: "S1",
    q: q("q4"),
    correct: true,
    answeredAt: at(E, -1000),
    counts: true,
  },
  // M3 answered qS BEFORE reviewing it: counts
  {
    who: "M3",
    pack: "main",
    skill: "S2",
    q: Q_SPOILED,
    correct: true,
    answeredAt: at(S, DAY),
    counts: true,
  },
  // another member's attempt on the question M3 reviewed still counts
  {
    who: "M4",
    pack: "main",
    skill: "S2",
    q: Q_SPOILED,
    correct: true,
    answeredAt: at(S, 4 * DAY),
    counts: true,
  },

  // in window, but before M2 joined the group: no (review B1)
  {
    who: "M2",
    pack: "main",
    skill: "S1",
    q: q("q6"),
    correct: true,
    answeredAt: at(S, DAY),
    counts: false,
  },
  // incorrect: no
  {
    who: "A",
    pack: "main",
    skill: "S1",
    q: q("q1"),
    correct: false,
    answeredAt: at(S, DAY),
    counts: false,
  },
  // at exactly ends_at: no (half-open)
  {
    who: "M3",
    pack: "main",
    skill: "S2",
    q: q("q2"),
    correct: true,
    answeredAt: E,
    counts: false,
  },
  // one second before starts_at: no
  {
    who: "M4",
    pack: "main",
    skill: "S1",
    q: q("q3"),
    correct: true,
    answeredAt: at(S, -1000),
    counts: false,
  },
  // skill of another domain: no
  {
    who: "A",
    pack: "main",
    skill: "OTHER",
    q: q("q5"),
    correct: true,
    answeredAt: at(S, DAY),
    counts: false,
  },
  // another pack: no
  {
    who: "A",
    pack: "other",
    skill: "S1",
    q: q("q1"),
    correct: true,
    answeredAt: at(S, DAY),
    counts: false,
  },
  // a non-member: no
  {
    who: "X",
    pack: "main",
    skill: "S1",
    q: q("q1"),
    correct: true,
    answeredAt: at(S, DAY),
    counts: false,
  },
  // a rejected question: no
  {
    who: "M2",
    pack: "main",
    skill: "S1",
    q: Q_REJECTED,
    correct: true,
    answeredAt: at(S, DAY),
    counts: false,
  },
  // M3 at exactly, and after, their own review of qS: no
  {
    who: "M3",
    pack: "main",
    skill: "S2",
    q: Q_SPOILED,
    correct: true,
    answeredAt: REVIEW_AT,
    counts: false,
  },
  {
    who: "M3",
    pack: "main",
    skill: "S2",
    q: Q_SPOILED,
    correct: true,
    answeredAt: at(REVIEW_AT, DAY),
    counts: false,
  },
];

/** The SC-2 figure, counted by hand from the fixture above. */
const EXPECTED_PROGRESS = 7;

function user(who: Who): TestUser {
  return { A, M2, M3, M4, X }[who];
}

function skillCode(ref: SkillRef): string {
  return { S1: SKILL_1, S2: SKILL_2, OTHER: OTHER_SKILL }[ref];
}

async function withDb<T>(
  fn: (db: ReturnType<typeof sql>) => Promise<T>,
): Promise<T> {
  const db = sql();
  try {
    return await fn(db);
  } finally {
    await db.end();
  }
}

/** "ok" on success, else the Postgres / PostgREST error code. */
async function code(
  promise: PromiseLike<{ error: { code?: string; message: string } | null }>,
): Promise<string> {
  const { error } = await promise;
  return error ? (error.code ?? error.message) : "ok";
}

function start(
  client: SupabaseClient,
  groupId: string,
  domainCode: string,
  target: number,
) {
  return client.rpc("start_expedition", {
    p_group_id: groupId,
    p_domain_code: domainCode,
    p_target: target,
  });
}

async function createGroup(
  admin: TestUser,
  members: readonly TestUser[],
  name: string,
): Promise<string> {
  const created = await admin.client.rpc("create_group", {
    p_name: `MF-0017 ${name} ${RUN}`,
    p_pack_slug: PACK,
  });
  if (created.error) throw created.error;
  const groupId = created.data as string;
  const group = await admin.client
    .from("groups")
    .select("invite_code")
    .eq("id", groupId)
    .single();
  if (group.error) throw group.error;
  for (const member of members) {
    const joined = await member.client.rpc("join_group", {
      p_code: group.data.invite_code,
    });
    if (joined.error) throw joined.error;
  }
  return groupId;
}

beforeAll(async () => {
  await withDb(async (db) => {
    const domains = await db<{ domain_code: string; skills: string[] }[]>`
      select domain_code, array_agg(skill_code order by skill_code) as skills
      from private.pack_skills where pack_slug = ${PACK}
      group by domain_code order by domain_code`;
    const main = domains.find((d) => d.skills.length >= 2);
    const other = domains.find((d) => d !== main);
    if (!main || !other)
      throw new Error(
        "private.pack_skills has no ccdv-f domains: the stack lacks synced keys (run pnpm dev:setup)",
      );
    DOMAIN = main.domain_code;
    DOMAIN_SKILLS = new Set(main.skills);
    [SKILL_1 = "", SKILL_2 = ""] = main.skills;
    OTHER_SKILL = other.skills[0] ?? "";
    const [foreign] = await db<{ domain_code: string }[]>`
      select domain_code from private.pack_skills
      where pack_slug <> ${PACK}
        and domain_code not in (select domain_code from private.pack_skills where pack_slug = ${PACK})
      order by domain_code limit 1`;
    if (!foreign)
      throw new Error(`no domain outside ${PACK}: the stack lacks synced keys`);
    FOREIGN_DOMAIN = foreign.domain_code;
  });

  [A, M2, M3, M4, X] = await Promise.all(
    ["a", "m2", "m3", "m4", "x"].map((n) =>
      createTestUser(`mf0017-${n}-${RUN}@example.test`),
    ),
  );
  G = await createGroup(A, [M2, M3, M4], "four");
  R = await createGroup(A, [M2, M3, M4], "race");
  SMALL = await createGroup(A, [M2, M3], "three");

  await withDb(async (db) => {
    for (const [who, joinedAt] of Object.entries(JOINED_AT)) {
      await db`
        update public.group_members set joined_at = ${joinedAt}
        where group_id = ${G} and user_id = ${user(who as Who).id}`;
    }
    // MF-0007: a reject resolution makes private.item_state(...) = 'rejected'; a review row spoils
    // the item for its reviewer from created_at on. Both need a registry row.
    for (const itemId of [Q_REJECTED, Q_SPOILED]) {
      await db`
        insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
        values (${itemId}, ${PACK}, ${itemId === Q_REJECTED ? SKILL_1 : SKILL_2}, 'question', ${HASH}, 'human')`;
    }
    await db`
      insert into private.flag_resolutions (item_id, content_hash, action, comment)
      values (${Q_REJECTED}, ${HASH}, 'reject', 'MF-0017 fixture')`;
    await db`
      insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict, created_at)
      values (${Q_SPOILED}, ${HASH}, ${M3.id}, 'approve', ${REVIEW_AT})`;
    for (const f of FIXTURE) {
      await db`
        insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
        values (${user(f.who).id}, ${f.pack === "main" ? PACK : OTHER_PACK}, ${skillCode(f.skill)},
                ${f.q}, ${["a"]}, ${f.correct}, ${f.answeredAt})`;
    }
  });
});

afterAll(async () => {
  // child-first; the expeditions table may not exist yet (red at freeze), so look before deleting
  await withDb(async (db) => {
    const groups = [G, R, SMALL].filter((id) => id !== "");
    const [table] = await db<{ ok: boolean }[]>`
      select to_regclass('public.expeditions') is not null as ok`;
    if (table?.ok && groups.length > 0)
      await db`delete from public.expeditions where group_id in ${db(groups)}`;
    await db`delete from public.attempts where question_id like ${`${PREFIX}%`}`;
    await db`delete from private.items where item_id like ${`${PREFIX}%`}`;
  });
  // users cascade to memberships, the groups they created and any remaining attempts
  await Promise.all(
    [A, M2, M3, M4, X].filter(Boolean).map((u) => deleteTestUser(u.id)),
  );
});

describe("MF-0017 expedition (DB)", () => {
  it("SC-1: a plain member and a non-member are refused (42501)", async () => {
    expect(await code(start(M2.client, G, DOMAIN, 100))).toBe("42501");
    expect(await code(start(X.client, G, DOMAIN, 100))).toBe("42501");
  });

  it("SC-1: the admin of a 3-member group is refused (P0001)", async () => {
    expect(await code(start(A.client, SMALL, DOMAIN, 100))).toBe("P0001");
  });

  it("SC-1: a domain outside the group's pack and a target outside 10–1000 are refused (22023)", async () => {
    expect(await code(start(A.client, G, "NOPE", 100))).toBe("22023");
    expect(await code(start(A.client, G, FOREIGN_DOMAIN, 100))).toBe("22023");
    expect(await code(start(A.client, G, DOMAIN, 9))).toBe("22023");
    expect(await code(start(A.client, G, DOMAIN, 1001))).toBe("22023");
    await withDb(async (db) => {
      const [n] = await db<{ n: number }[]>`
        select count(*)::int as n from public.expeditions where group_id = ${G}`;
      expect(n?.n).toBe(0);
    });
  });

  it("SC-1: the admin starts one (target 10, the lower bound); the database starts it open, from its own clock", async () => {
    const created = await start(A.client, G, DOMAIN, 10);
    expect(created.error).toBeNull();
    EXPEDITION_G = created.data as string;
    expect(EXPEDITION_G).toMatch(/^[0-9a-f-]{36}$/);

    await withDb(async (db) => {
      const [row] = await db<
        {
          group_id: string;
          domain_code: string;
          target: number;
          created_by: string;
          open: boolean;
          fresh: boolean;
          starts_at: Date;
        }[]
      >`
        select group_id, domain_code, target, created_by, starts_at,
               ends_at is null as open,
               starts_at between now() - interval '1 minute' and now() as fresh
        from public.expeditions where id = ${EXPEDITION_G}`;
      expect(row).toMatchObject({
        group_id: G,
        domain_code: DOMAIN,
        target: 10,
        created_by: A.id,
        open: true,
        fresh: true,
      });
      // the client cannot send a time: the function takes exactly these three arguments
      const [sig] = await db<{ args: string }[]>`
        select pg_get_function_identity_arguments(to_regprocedure(${START_FN})) as args`;
      expect(sig?.args).toBe(
        "p_group_id uuid, p_domain_code text, p_target integer",
      );

      // a plain member reads the same row back through the member read
      const latest = await M2.client.rpc("latest_expedition", {
        p_group_id: G,
      });
      expect(latest.error).toBeNull();
      expect(latest.data).toHaveLength(1);
      expect(latest.data?.[0]).toMatchObject({
        id: EXPEDITION_G,
        domain_code: DOMAIN,
        target: 10,
      });
      expect(new Date(latest.data?.[0]?.starts_at).getTime()).toBe(
        row?.starts_at.getTime(),
      );
    });
  });

  it("SC-1: a second start while one is active is refused (23P01)", async () => {
    expect(await code(start(A.client, G, DOMAIN, 100))).toBe("23P01");
  });

  it("SC-1: two concurrent starts by the admin: exactly one succeeds and one row exists", async () => {
    const results = await Promise.all([
      code(start(A.client, R, DOMAIN, 1000)),
      code(start(A.client, R, DOMAIN, 1000)),
    ]);
    expect(results.sort()).toEqual(["23P01", "ok"]);
    await withDb(async (db) => {
      const [n] = await db<{ n: number }[]>`
        select count(*)::int as n from public.expeditions where group_id = ${R}`;
      expect(n?.n).toBe(1);
    });
  });

  it("SC-2: progress counts only countable correct recalls by members, in the domain, in [starts_at, ends_at): 7", async () => {
    // deterministic window (see S / E above); still exactly 7 days
    await withDb(async (db) => {
      await db`
        update public.expeditions set starts_at = ${S}, ends_at = ${E}
        where id = ${EXPEDITION_G}`;
    });
    for (const member of [A, M3]) {
      const { data, error } = await member.client.rpc("expedition_progress", {
        p_expedition_id: EXPEDITION_G,
      });
      expect(error).toBeNull();
      expect(data).toBe(EXPECTED_PROGRESS);
    }
  });

  it("SC-2: parity: countableAttempts over the same fixture gives the same count as the SQL", async () => {
    const members = ["A", "M2", "M3", "M4"] as const;
    const windowStart = new Date(S).getTime();
    const windowEnd = new Date(E).getTime();
    let total = 0;
    for (const who of members) {
      const joinedAt = new Date(JOINED_AT[who]).getTime();
      const context: ReviewContext = emptyReviewContext();
      context.rejected.add(Q_REJECTED);
      if (who === "M3") {
        context.spoiledBy.add(Q_SPOILED);
        context.spoiledAt.set(Q_SPOILED, new Date(REVIEW_AT));
      }
      const attempts: Attempt[] = FIXTURE.filter(
        (f) => f.who === who && f.pack === "main",
      ).map((f) => ({
        questionId: f.q,
        skillCode: skillCode(f.skill),
        correct: f.correct,
        answeredAt: new Date(f.answeredAt),
      }));
      total += countableAttempts(attempts, context).filter(
        (a) =>
          a.correct &&
          DOMAIN_SKILLS.has(a.skillCode) &&
          a.answeredAt.getTime() >= windowStart &&
          a.answeredAt.getTime() < windowEnd &&
          a.answeredAt.getTime() >= joinedAt,
      ).length;
    }
    expect(total).toBe(EXPECTED_PROGRESS);
    expect(FIXTURE.filter((f) => f.counts)).toHaveLength(EXPECTED_PROGRESS);

    const { data, error } = await M2.client.rpc("expedition_progress", {
      p_expedition_id: EXPEDITION_G,
    });
    expect(error).toBeNull();
    expect(data).toBe(total);
  });

  it("SC-3: nobody reads public.expeditions directly: member, non-member and anon get a permission error", async () => {
    for (const client of [A.client, M2.client, X.client, anonClient()]) {
      const { data, error } = await client
        .from("expeditions")
        .select("id")
        .eq("group_id", G);
      expect(error?.code).toBe("42501");
      expect(data ?? []).toEqual([]);
    }
  });

  it("SC-3: latest_expedition: admin and member get the same single row; a non-member is refused; never-had-one is empty; most recent wins", async () => {
    // an older, ended expedition in G: the read must return the newer one
    await withDb(async (db) => {
      await db`
        insert into public.expeditions (id, group_id, domain_code, target, starts_at, ends_at, created_by)
        values (gen_random_uuid(), ${G}, ${DOMAIN}, 50, '2026-09-01T10:00:00Z', '2026-09-08T10:00:00Z', ${A.id})`;
    });
    const asAdmin = await A.client.rpc("latest_expedition", { p_group_id: G });
    const asMember = await M2.client.rpc("latest_expedition", {
      p_group_id: G,
    });
    expect(asAdmin.error).toBeNull();
    expect(asMember.error).toBeNull();
    expect(asAdmin.data).toHaveLength(1);
    expect(asMember.data).toEqual(asAdmin.data);
    const row = asAdmin.data?.[0];
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "domain_code",
      "ends_at",
      "id",
      "starts_at",
      "target",
    ]);
    expect(row).toMatchObject({
      id: EXPEDITION_G,
      domain_code: DOMAIN,
      target: 10,
    });
    expect(new Date(row?.starts_at).toISOString()).toBe(S);
    expect(new Date(row?.ends_at).toISOString()).toBe(E);

    expect(
      await code(X.client.rpc("latest_expedition", { p_group_id: G })),
    ).toBe("42501");

    const never = await A.client.rpc("latest_expedition", {
      p_group_id: SMALL,
    });
    expect(never.error).toBeNull();
    expect(never.data).toEqual([]);
  });

  it("SC-3: expedition_progress refuses a non-member (42501) and a group of fewer than 4 members (P0001)", async () => {
    expect(
      await code(
        X.client.rpc("expedition_progress", { p_expedition_id: EXPEDITION_G }),
      ),
    ).toBe("42501");
    const smallId = await withDb(async (db) => {
      const [row] = await db<{ id: string }[]>`
        insert into public.expeditions (id, group_id, domain_code, target, starts_at, ends_at, created_by)
        values (gen_random_uuid(), ${SMALL}, ${DOMAIN}, 100, now(), now() + interval '7 days', ${A.id})
        returning id`;
      return row?.id ?? "";
    });
    expect(
      await code(
        A.client.rpc("expedition_progress", { p_expedition_id: smallId }),
      ),
    ).toBe("P0001");
    expect(
      await code(
        M2.client.rpc("expedition_progress", { p_expedition_id: smallId }),
      ),
    ).toBe("P0001");
  });

  it("SC-3: anon executes neither read; the progress read returns one integer, never a per-member set", async () => {
    await withDb(async (db) => {
      const [p] = await db<
        {
          exists: boolean;
          anon_progress: boolean;
          anon_latest: boolean;
          auth_progress: boolean;
          auth_latest: boolean;
          auth_start: boolean;
          result: string;
        }[]
      >`
        select to_regprocedure(${PROGRESS_FN}) is not null
                 and to_regprocedure(${LATEST_FN}) is not null
                 and to_regprocedure(${START_FN}) is not null as exists,
               has_function_privilege('anon', to_regprocedure(${PROGRESS_FN}), 'EXECUTE') as anon_progress,
               has_function_privilege('anon', to_regprocedure(${LATEST_FN}), 'EXECUTE') as anon_latest,
               has_function_privilege('authenticated', to_regprocedure(${PROGRESS_FN}), 'EXECUTE') as auth_progress,
               has_function_privilege('authenticated', to_regprocedure(${LATEST_FN}), 'EXECUTE') as auth_latest,
               has_function_privilege('authenticated', to_regprocedure(${START_FN}), 'EXECUTE') as auth_start,
               pg_get_function_result(to_regprocedure(${PROGRESS_FN})) as result`;
      expect(p).toEqual({
        exists: true,
        anon_progress: false,
        anon_latest: false,
        auth_progress: true,
        auth_latest: true,
        auth_start: true,
        result: "integer",
      });
    });
    const anon = anonClient();
    expect(
      await code(
        anon.rpc("expedition_progress", { p_expedition_id: EXPEDITION_G }),
      ),
    ).not.toBe("ok");
    expect(
      await code(anon.rpc("latest_expedition", { p_group_id: G })),
    ).not.toBe("ok");
  });

  it("SC-3: attempts RLS still returns a member's own rows only", async () => {
    const own = await M2.client
      .from("attempts")
      .select("user_id, question_id")
      .like("question_id", `${PREFIX}%`);
    expect(own.error).toBeNull();
    // M2's fixture rows: q2, q4 and the rejected question
    expect(own.data?.map((r) => r.user_id)).toEqual([
      M2.id,
      M2.id,
      M2.id,
      M2.id,
    ]);
  });
});
