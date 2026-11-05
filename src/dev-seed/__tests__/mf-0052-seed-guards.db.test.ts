/**
 * MF-0052 BUILD regressions (riskiest step): what the seed must refuse, before any delete, when state it
 * does not own blocks a storm, and how an older manifest is treated. LOCAL stack (pnpm test:db),
 * run-scoped emails; `it` blocks share one fixture in order. Each case was shown RED on the code
 * without its guard (LOOP-VERIFY.md, "BUILD regressions").
 */
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
import { reviewQueueOwners } from "../review-queue-owners";
import { seedDemoWorlds } from "../seed-demo-world";
import type { DemoWorld, SeedManifest } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0052g-${RUN}.test`;
// prod-prompting first: a refusal caused by ccdv-f (world 2) must keep world 1's data too
const PACKS = ["prod-prompting", "ccdv-f"] as const;
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

function seed(previous: SeedManifest | null): Promise<SeedManifest> {
  return seedDemoWorlds({
    sql: db,
    admin,
    worlds,
    demoDomain: DEMO,
    youEmail: YOU.email,
    previous,
  });
}

async function yourStormIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from public.storms where user_id = ${YOU.id} order by id`;
  return rows.map((r) => r.id);
}

/** Everything a refused run must leave exactly as it was. */
async function snapshot() {
  const demo = await demoUserIds();
  const groups = await db<{ id: string; pack_slug: string }[]>`
    select id, pack_slug from public.groups where created_by = any(${demo}::uuid[]) order by id`;
  const storms = await db<{ id: string }[]>`
    select id from public.storms where user_id = any(${[...demo, YOU.id]}::uuid[]) order by id`;
  const expeditions = await db<{ id: string }[]>`
    select e.id from public.expeditions e
    where e.group_id = any(${groups.map((g) => g.id)}::uuid[]) order by e.id`;
  const attempts = await db<{ id: string }[]>`
    select id::text from public.attempts where user_id = ${YOU.id} order by id`;
  return {
    demo,
    groups: groups.map((g) => `${g.pack_slug}:${g.id}`),
    storms: storms.map((s) => s.id),
    expeditions: expeditions.map((e) => e.id),
    yourAttempts: attempts.map((a) => a.id),
  };
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0052g.test`);
  const packs = [];
  for (const slug of PACKS) {
    const inputs = await loadSeedInputs(join(process.cwd(), "packs", slug));
    packs.push({
      pack: inputs.pack,
      groupName: `Demo ${slug}`,
      questions: inputs.questions,
      items: inputs.items,
    });
  }
  worlds = planDemoWorlds({
    now: new Date(),
    seed: 42,
    youEmail: YOU.email,
    demoDomain: DEMO,
    packs,
  });
  latest = await seed(null);
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  await db`delete from private.item_reviews where reviewer_id = ${YOU.id}`;
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0052 seed guards", () => {
  it("refuses before any delete while you have an unfinished storm", async () => {
    const [running] = await db<{ id: string }[]>`
      insert into public.storms (user_id, pack_slug, kind, domain_code, started_at, ends_at)
      values (${YOU.id}, 'ccdv-f', 'boss', 'D1', now() - interval '5 minutes', now() + interval '1 hour')
      returning id`;
    if (!running) throw new Error("fixture: running storm not inserted");
    try {
      const before = await snapshot();
      await expect(seed(latest)).rejects.toThrow(/unfinished storm/);
      expect(await snapshot()).toEqual(before);
    } finally {
      await db`delete from public.storms where id = ${running.id}`;
    }
  });

  it("refuses before any delete when a question of your planned storm is spoiled for you, keeping world 1 (another pack) too", async () => {
    const ccdv = worlds.find((w) => w.group.packSlug === "ccdv-f");
    const question = ccdv?.storms.find(
      (s) => s.email.toLowerCase() === YOU.email,
    )?.questions[0];
    if (!question) throw new Error("fixture: no storm question of yours");
    await db`
      insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict)
      values (${question.questionId}, ${question.contentHash}, ${YOU.id}, 'approve')`;
    try {
      const before = await snapshot();
      expect(before.groups.some((g) => g.startsWith("prod-prompting:"))).toBe(
        true,
      );
      await expect(seed(latest)).rejects.toThrow(/spoiled/);
      expect(await snapshot()).toEqual(before);
    } finally {
      await db`delete from private.item_reviews where reviewer_id = ${YOU.id}`;
    }
  });

  it("a manifest written before MF-0052 (no storm ids) deletes none of your storms; the next run replaces only the ones it recorded", async () => {
    const firstRun = await yourStormIds();
    expect(firstRun.length).toBeGreaterThanOrEqual(2);
    const old: SeedManifest = {
      youId: latest.youId,
      youAttemptIds: latest.youAttemptIds,
    };
    const second = await seed(old);
    const afterOld = await yourStormIds();
    for (const id of firstRun) expect(afterOld).toContain(id);

    latest = await seed(second);
    const afterNext = await yourStormIds();
    for (const id of firstRun) expect(afterNext).toContain(id);
    for (const id of second.youStormIds ?? [])
      expect(afterNext).not.toContain(id);
    expect(afterNext).toHaveLength(firstRun.length * 2);
  });

  it("names, per pack, an account whose review queue is non-empty", async () => {
    const demo = worlds[0]?.learners.map((l) => l.email) ?? [];
    const owners = await reviewQueueOwners(db, {
      packSlugs: [...PACKS],
      emails: demo,
    });
    expect(owners.map((o) => o.packSlug)).toEqual([...PACKS]);
    for (const o of owners) expect(o.email).not.toBeNull();
  });
});
