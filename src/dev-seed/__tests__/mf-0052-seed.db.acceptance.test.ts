/**
 * MF-0052 acceptance (frozen, DB half): ccdv-f and prod-prompting seeded together on the LOCAL stack
 * (pnpm test:db). Run-scoped emails, so the developer's own data is never touched; `it` blocks share
 * one fixture. Expected values are literals from .planning/tasks/MF-0052/GOAL.md. Reads that the app
 * makes as the signed-in learner are made here through YOUR session (RLS applies); the engine calls
 * are the ones the Today page makes.
 */
import { join } from "node:path";
import type { TransactionSql } from "postgres";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { reviewContextFromRows } from "@/engine/content";
import { buildForest, summarizeForest } from "@/engine/forest";
import { countableAttempts, memoryBySkill } from "@/engine/memory";
import { loadPackFile } from "@/engine/pack";
import { readiness } from "@/engine/readiness";
import { readinessStorms, stormProof } from "@/engine/storm";
import { LatestExpeditionRows } from "@/server/expeditions/types";
import { fetchAttempts } from "@/server/memory/fetch-attempts";
import { PendingAnalogyRows, ReviewStateRows } from "@/server/review/types";
import { fetchStormResults } from "@/server/storm/fetch-storm-results";
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

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0052-${RUN}.test`;
const PACKS = ["ccdv-f", "prod-prompting"] as const;
const PACKS_DIR = join(process.cwd(), "packs");
const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date();

let YOU: TestUser;
const db = sql();
const admin = adminClient();

async function demoUserIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}
    order by id`;
  return rows.map((r) => r.id);
}

async function demoGroups(): Promise<{ id: string; pack_slug: string }[]> {
  return db<{ id: string; pack_slug: string }[]>`
    select g.id, g.pack_slug from public.groups g
    where g.created_by = any(${await demoUserIds()}::uuid[])
    order by g.pack_slug`;
}

/** Run `fn` as `userId` (auth.uid()), the way PostgREST would: role authenticated + JWT claims. */
async function asUser<T>(
  userId: string,
  fn: (tx: TransactionSql) => Promise<T>,
): Promise<T> {
  const out = await db.begin(async (tx) => {
    await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
    await tx`set local role authenticated`;
    return fn(tx);
  });
  return out as T;
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0052.test`);
  const packs = [];
  for (const slug of PACKS) {
    const inputs = await loadSeedInputs(join(PACKS_DIR, slug));
    packs.push({
      pack: inputs.pack,
      groupName: `Demo ${slug}`,
      questions: inputs.questions,
      items: inputs.items,
    });
  }
  const worlds = planDemoWorlds({
    now: NOW,
    seed: 42,
    youEmail: YOU.email,
    demoDomain: DEMO,
    packs,
  });
  await seedDemoWorlds({
    sql: db,
    admin,
    worlds,
    demoDomain: DEMO,
    youEmail: YOU.email,
    previous: null,
  });
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0052 seeded demo world", () => {
  it("SC-1: your groups by joined_at desc start with ccdv-f, and every join precedes the world's first answer", async () => {
    // listMyGroups' order (src/server/groups/list-my-groups.ts): joined_at desc
    const mine = await db<{ pack_slug: string; joined_at: Date }[]>`
      select g.pack_slug, m.joined_at from public.group_members m
      join public.groups g on g.id = m.group_id
      where m.user_id = ${YOU.id}
      order by m.joined_at desc`;
    expect(mine.map((g) => g.pack_slug)).toEqual(["ccdv-f", "prod-prompting"]);
    // strictly newer: no tie for Postgres to break either way
    expect(mine[0]?.joined_at.getTime()).toBeGreaterThan(
      mine[1]?.joined_at.getTime() ?? Number.POSITIVE_INFINITY,
    );

    const members = [...(await demoUserIds()), YOU.id];
    for (const group of await demoGroups()) {
      const [first] = await db<{ at: Date | null }[]>`
        select min(answered_at) as at from public.attempts
        where pack_slug = ${group.pack_slug} and user_id = any(${members}::uuid[])`;
      expect(first?.at).toBeInstanceOf(Date);
      const joins = await db<{ joined_at: Date }[]>`
        select joined_at from public.group_members where group_id = ${group.id}`;
      expect(joins).toHaveLength(6);
      for (const j of joins)
        expect(j.joined_at.getTime()).toBeLessThan(
          first?.at?.getTime() ?? Number.NEGATIVE_INFINITY,
        );
    }
  });

  it("SC-3: finished, DB-graded storms: you 1 Full + 1 Boss, each demo learner 1 Full, none running; prod-prompting has none", async () => {
    const demo = await demoUserIds();
    expect(demo).toHaveLength(5);
    const everyone = [...demo, YOU.id];
    const storms = await db<
      {
        id: string;
        user_id: string;
        pack_slug: string;
        kind: string;
        finished_at: Date | null;
      }[]
    >`
      select id, user_id, pack_slug, kind, finished_at from public.storms
      where user_id = any(${everyone}::uuid[])`;

    expect(storms.filter((s) => s.finished_at === null)).toEqual([]);
    for (const s of storms)
      expect(s.finished_at?.getTime()).toBeLessThan(Date.now());
    expect(storms.filter((s) => s.pack_slug === "prod-prompting")).toEqual([]);

    const count = (userId: string, kind: string): number =>
      storms.filter(
        (s) =>
          s.user_id === userId && s.kind === kind && s.pack_slug === "ccdv-f",
      ).length;
    expect(count(YOU.id, "full")).toBe(1);
    expect(count(YOU.id, "boss")).toBe(1);
    for (const id of demo) {
      expect(count(id, "full")).toBe(1);
      expect(count(id, "boss")).toBe(0);
    }

    // graded by private.finalize_storm: one attempt per answered, unvoided question, carrying storm_id,
    // with the stored answer, its grade and answered_at = chosen_at
    for (const s of storms) {
      const graded = await db<
        { question_id: string; chosen: string[]; correct: boolean; at: Date }[]
      >`
        select question_id, chosen, correct, chosen_at as at from public.storm_questions
        where storm_id = ${s.id} and not voided and chosen is not null
        order by question_id`;
      const made = await db<
        { question_id: string; chosen: string[]; correct: boolean; at: Date }[]
      >`
        select question_id, chosen, correct, answered_at as at from public.attempts
        where storm_id = ${s.id} order by question_id`;
      expect(graded.length).toBeGreaterThan(0);
      expect(made).toEqual(graded);
    }

    // your Full Storm proves >= 3 skills (>= 2 questions, all right) and has >= 1 wrong answer
    const full = storms.find((s) => s.user_id === YOU.id && s.kind === "full");
    if (!full) throw new Error("no Full Storm for you");
    const [proof] = await db<{ proven: number; wrong: number }[]>`
      select
        (select count(*)::int from (
          select skill_code from public.storm_questions
          where storm_id = ${full.id} and not voided
          group by skill_code
          having count(*) >= 2 and bool_and(coalesce(correct, false))
        ) p) as proven,
        (select count(*)::int from public.storm_questions
          where storm_id = ${full.id} and not voided and correct = false) as wrong`;
    expect(proof?.proven).toBeGreaterThanOrEqual(3);
    expect(proof?.wrong).toBeGreaterThanOrEqual(1);
  });

  it("SC-4: through Today's path (fetchStormResults → stormProof → memoryBySkill / readiness), you have >= 1 ccdv-f Tree and a storm value on >= 1 domain", async () => {
    const pack = await loadPackFile(join(PACKS_DIR, "ccdv-f", "pack.yaml"));
    const now = new Date();
    const [attempts, stormResults, states] = await Promise.all([
      fetchAttempts(YOU.client, YOU.id, "ccdv-f"),
      fetchStormResults(YOU.client, YOU.id, "ccdv-f"),
      YOU.client.rpc("review_states", { p_pack_slug: "ccdv-f" }),
    ]);
    expect(states.error).toBeNull();
    const review = reviewContextFromRows(
      ReviewStateRows.parse(states.data).map((r) => ({
        itemId: r.item_id,
        state: r.state,
        reviewedAt: r.reviewed_at,
      })),
    );
    const countable = countableAttempts(attempts, review);
    const proof = stormProof(stormResults, review.rejected);
    const summary = summarizeForest(
      buildForest(pack, memoryBySkill(countable, now, proof)),
    );
    expect(summary.stageCounts.tree).toBeGreaterThanOrEqual(1);

    const forecast = readiness({
      pack,
      attempts: countable,
      storms: readinessStorms(pack, stormResults),
      now,
    });
    expect(forecast).not.toBeNull();
    expect(
      forecast?.domains.filter((d) => d.stormPercent !== null).length,
    ).toBeGreaterThanOrEqual(1);
  });

  it("SC-5: each demo group has one active expedition (started 3 days ago) on its busiest domain, with 0 < progress < target as you", async () => {
    const groups = await demoGroups();
    expect(groups.map((g) => g.pack_slug)).toEqual([...PACKS]);
    for (const group of groups) {
      const all = await db<{ id: string }[]>`
        select id from public.expeditions where group_id = ${group.id}`;
      expect(all).toHaveLength(1);

      const latest = await YOU.client.rpc("latest_expedition", {
        p_group_id: group.id,
      });
      expect(latest.error).toBeNull();
      const [row] = LatestExpeditionRows.parse(latest.data);
      if (!row) throw new Error(`no expedition in ${group.pack_slug}`);
      const startsAt = new Date(row.starts_at).getTime();
      expect(Math.abs(startsAt - (NOW.getTime() - 3 * DAY))).toBeLessThan(
        5 * 60 * 1000,
      );
      expect(startsAt).toBeLessThanOrEqual(Date.now());
      expect(row.ends_at).toBeNull();

      const progress = await YOU.client.rpc("expedition_progress", {
        p_expedition_id: row.id,
      });
      expect(progress.error).toBeNull();
      expect(progress.data).toBeGreaterThan(0);
      expect(progress.data).toBeLessThan(row.target);

      // the expedition's domain has the most correct recalls in the window (members, since joining)
      const perDomain = await db<{ domain_code: string; n: number }[]>`
        select ps.domain_code, count(a.id)::int as n
        from private.pack_skills ps
        left join public.attempts a
          on a.pack_slug = ps.pack_slug and a.skill_code = ps.skill_code and a.correct
          and a.answered_at >= ${row.starts_at} and a.answered_at < coalesce(${row.ends_at}::timestamptz, 'infinity')
          and exists (
            select 1 from public.group_members m
            where m.group_id = ${group.id} and m.user_id = a.user_id and a.answered_at >= m.joined_at)
        where ps.pack_slug = ${group.pack_slug}
        group by ps.domain_code`;
      const best = Math.max(...perDomain.map((d) => d.n));
      expect(perDomain.find((d) => d.domain_code === row.domain_code)?.n).toBe(
        best,
      );
    }
  });

  it("SC-6: per pack, you see >= 1 open flag and >= 1 pending analogy you can approve, and a seeded learner has a non-empty review queue", async () => {
    const learners = [YOU.id, ...(await demoUserIds())];
    for (const slug of PACKS) {
      const flags = await YOU.client.rpc("list_open_flags", {
        p_pack_slug: slug,
      });
      expect(flags.error).toBeNull();
      expect(flags.data?.length ?? 0).toBeGreaterThanOrEqual(1);

      const analogies = await YOU.client.rpc("list_pending_analogies", {
        p_pack_slug: slug,
      });
      expect(analogies.error).toBeNull();
      expect(
        PendingAnalogyRows.parse(analogies.data).filter((a) => a.can_approve)
          .length,
      ).toBeGreaterThanOrEqual(1);

      const queues: number[] = [];
      for (const id of learners) {
        const rows = await asUser(
          id,
          (tx) => tx`select item_id from public.list_reviewable(${slug})`,
        );
        queues.push(rows.length);
      }
      expect(Math.max(...queues)).toBeGreaterThan(0);
    }
  });
});
