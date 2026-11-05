/**
 * MF-0052 acceptance (frozen, SC-8): re-run and reset safety of the seeded storms and expeditions on
 * the LOCAL stack (pnpm test:db). Run-scoped emails; `it` blocks run in order on one fixture and each
 * re-run chains the manifest the previous one returned. Expected counts are SC-3's literals.
 */
import { randomUUID } from "node:crypto";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorlds } from "../plan-demo-world";
import { seedDemoWorlds } from "../seed-demo-world";
import type { DemoWorld, SeedManifest } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0052r-${RUN}.test`;
const db = sql();
const admin = adminClient();
let YOU: TestUser;
let worlds: DemoWorld[];
let latest: SeedManifest;

async function demoUserIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}
    order by id`;
  return rows.map((r) => r.id);
}

function seed(
  previous: SeedManifest | null,
  input: readonly DemoWorld[] = worlds,
): Promise<SeedManifest> {
  return seedDemoWorlds({
    sql: db,
    admin,
    worlds: input,
    demoDomain: DEMO,
    youEmail: YOU.email,
    previous,
  });
}

/** Storm counts per learner (you, then the 5 demo learners in id order) and expeditions per demo group. */
async function counts() {
  const demo = await demoUserIds();
  const per = async (userId: string) => {
    const [row] = await db<{ full: number; boss: number; running: number }[]>`
      select
        count(*) filter (where kind = 'full')::int as full,
        count(*) filter (where kind = 'boss')::int as boss,
        count(*) filter (where finished_at is null)::int as running
      from public.storms where user_id = ${userId} and pack_slug = 'ccdv-f'`;
    return row;
  };
  const expeditions = await db<{ n: number }[]>`
    select count(e.id)::int as n from public.groups g
    left join public.expeditions e on e.group_id = g.id
    where g.created_by = any(${demo}::uuid[])
    group by g.id order by g.id`;
  return {
    you: await per(YOU.id),
    demo: await Promise.all(demo.map(per)),
    expeditions: expeditions.map((e) => e.n),
  };
}

const SC3 = {
  you: { full: 1, boss: 1, running: 0 },
  demo: Array.from({ length: 5 }, () => ({ full: 1, boss: 0, running: 0 })),
  expeditions: [1],
};

/** What a refused run must leave exactly as it was. */
async function snapshot() {
  const demo = await demoUserIds();
  const storms = await db<{ id: string }[]>`
    select id from public.storms
    where user_id = any(${[...demo, YOU.id]}::uuid[]) order by id`;
  const expeditions = await db<{ id: string }[]>`
    select e.id from public.expeditions e join public.groups g on g.id = e.group_id
    where g.created_by = any(${demo}::uuid[]) order by e.id`;
  const attempts = await db<{ id: string }[]>`
    select id::text from public.attempts where user_id = ${YOU.id} order by id`;
  return {
    demo,
    storms: storms.map((s) => s.id),
    expeditions: expeditions.map((e) => e.id),
    yourAttempts: attempts.map((a) => a.id),
  };
}

async function yourStormIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from public.storms where user_id = ${YOU.id} order by id`;
  return rows.map((r) => r.id);
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0052r.test`);
  const inputs = await loadSeedInputs(join(process.cwd(), "packs", "ccdv-f"));
  worlds = planDemoWorlds({
    now: new Date(),
    seed: 42,
    youEmail: YOU.email,
    demoDomain: DEMO,
    packs: [
      {
        pack: inputs.pack,
        groupName: "Demo ccdv-f",
        questions: inputs.questions,
        items: inputs.items,
      },
    ],
  });
  latest = await seed(null);
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0052 SC-8 re-run and reset safety", () => {
  it("(a) a second run replaces the seeded storms and expeditions, leaving exactly the SC-3 counts", async () => {
    expect(await counts()).toEqual(SC3);
    const firstStorms = await yourStormIds();
    latest = await seed(latest);
    expect(await counts()).toEqual(SC3);
    // replaced, not kept: none of the first run's storms of yours is left
    const now = await yourStormIds();
    expect(now.filter((id) => firstStorms.includes(id))).toEqual([]);
  });

  it("(b) a storm you played by hand (not in the manifest) survives a re-run", async () => {
    const [hand] = await db<{ id: string }[]>`
      insert into public.storms (user_id, pack_slug, kind, domain_code, started_at, ends_at, finished_at)
      values (${YOU.id}, 'ccdv-f', 'boss', 'D1', now() - interval '2 hours',
              now() - interval '90 minutes', now() - interval '90 minutes')
      returning id`;
    if (!hand) throw new Error("fixture: hand storm not inserted");
    latest = await seed(latest);
    const [kept] =
      await db`select id from public.storms where id = ${hand.id} and user_id = ${YOU.id}`;
    expect(kept).toBeDefined();
    expect(await counts()).toEqual({
      ...SC3,
      you: { full: 1, boss: 2, running: 0 },
    });
  });

  it("(c) a manifest from another account (e.g. before a db:reset) deletes none of your storms or answers", async () => {
    // meaningful only if the seed put storms of yours there (the hand-played one alone proves nothing)
    expect((await counts()).you?.full).toBeGreaterThanOrEqual(1);
    const before = await snapshot();
    const stale: SeedManifest = {
      youId: randomUUID(),
      youAttemptIds: latest.youAttemptIds,
      youStormIds: await yourStormIds(),
    };
    latest = await seed(stale);
    const after = await snapshot();
    const yours = await yourStormIds();
    for (const id of stale.youStormIds ?? []) expect(yours).toContain(id);
    for (const id of before.yourAttempts)
      expect(after.yourAttempts).toContain(id);
  });

  it("(d) a bad input (unregistered pack, stale review hash) fails before any delete: storms and expedition stay", async () => {
    const [good] = worlds;
    if (!good) throw new Error("fixture: no world");
    expect((await counts()).you?.full).toBeGreaterThanOrEqual(1);
    const before = await snapshot();
    expect(before.expeditions).toHaveLength(1);

    await expect(
      seed(latest, [
        good,
        { ...good, group: { ...good.group, packSlug: `missing-${RUN}` } },
      ]),
    ).rejects.toThrow(/not registered/);
    expect(await snapshot()).toEqual(before);

    const [head, ...rest] = good.reviews;
    if (!head) throw new Error("fixture: the plan has no reviews");
    await expect(
      seed(latest, [
        {
          ...good,
          reviews: [{ ...head, contentHash: "0".repeat(64) }, ...rest],
        },
      ]),
    ).rejects.toThrow(/stale/);
    expect(await snapshot()).toEqual(before);
  });
});
