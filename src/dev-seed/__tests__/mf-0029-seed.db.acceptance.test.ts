/**
 * MF-0029 acceptance (frozen, DB half): the demo world written to the LOCAL stack (pnpm test:db).
 * Run-scoped emails, so the developer's own data is never touched; `it` blocks share the fixture in
 * order. Expected values are literals from .planning/tasks/MF-0029/GOAL.md SC-4..SC-6.
 */
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { groupHeatmapFromAttempts } from "@/engine/forest";
import { fetchGroupAttempts } from "@/server/groups/fetch-group-attempts";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorld } from "../plan-demo-world";
import { seedDemoWorld } from "../seed-demo-world";
import type { DemoWorld, SeedManifest } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0029-${RUN}.test`;
const PACK_DIR = join(process.cwd(), "packs/ccdv-f");

let YOU: TestUser;
let OUTSIDER: TestUser;
let world: DemoWorld;
let pack: Awaited<ReturnType<typeof loadSeedInputs>>["pack"];
let first: SeedManifest;
const db = sql();
const admin = adminClient();

async function demoUserIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from auth.users where lower(email) like ${`%@${DEMO}`}`;
  return rows.map((r) => r.id);
}

async function counts() {
  const ids = await demoUserIds();
  const [g] = await db<{ groups: number; members: number }[]>`
    select count(distinct g.id)::int as groups, count(m.user_id)::int as members
    from public.groups g join public.group_members m on m.group_id = g.id
    where g.created_by = any(${ids}::uuid[])`;
  const attempts = await db<{ user_id: string; n: number }[]>`
    select user_id, count(*)::int as n from public.attempts
    where user_id = any(${[...ids, YOU.id]}::uuid[]) group by user_id order by user_id`;
  const [r] = await db<{ n: number }[]>`
    select count(*)::int as n from private.item_reviews where reviewer_id = any(${ids}::uuid[])`;
  const [cm] = await db<{ n: number }[]>`
    select count(*)::int as n from private.content_maintainers where lower(email) = ${YOU.email}`;
  return {
    users: ids.length,
    groups: g?.groups,
    members: g?.members,
    attempts,
    reviews: r?.n,
    maintainers: cm?.n,
  };
}

async function outsiderSnapshot(): Promise<unknown> {
  return {
    attempts: await db`
      select question_id, chosen, correct, answered_at from public.attempts
      where user_id = ${OUTSIDER.id} order by id`,
    profile: await db`select * from public.profiles where id = ${OUTSIDER.id}`,
    memberships: await db`
      select group_id, role from public.group_members where user_id = ${OUTSIDER.id}`,
  };
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0029.test`);
  OUTSIDER = await createTestUser(`outsider-${RUN}@mf0029.test`);
  const inputs = await loadSeedInputs(PACK_DIR);
  pack = inputs.pack;
  world = planDemoWorld({
    now: new Date(),
    seed: 42,
    packSlug: "ccdv-f",
    youEmail: YOU.email,
    demoDomain: DEMO,
    questions: inputs.questions,
    items: inputs.items,
  });
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  if (OUTSIDER) await deleteTestUser(OUTSIDER.id);
  await db.end();
});

describe("MF-0029 demo seed on the local stack", () => {
  it("SC-5 (grading parity): record_attempt grades 10 planned answers exactly as the plan did", async () => {
    const sample = world.attempts.filter((_, i) => i % 7 === 0).slice(0, 10);
    expect(sample).toHaveLength(10);
    for (const t of sample) {
      const { data, error } = await OUTSIDER.client.rpc("record_attempt", {
        p_question_id: t.questionId,
        p_chosen: t.chosen,
      });
      expect(error).toBeNull();
      expect(data).toBe(t.correct);
    }
  });

  it("SC-4: 5 demo users with readable names, one ccdv-f group of 6 with you as admin, planned attempts, you as analogy owner, a visible heatmap", async () => {
    const before = await outsiderSnapshot();
    first = await seedDemoWorld({
      sql: db,
      admin,
      world,
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: null,
    });

    const users = await db<{ email: string; display_name: string }[]>`
      select u.email, p.display_name from auth.users u join public.profiles p on p.id = u.id
      where lower(u.email) like ${`%@${DEMO}`} order by u.email`;
    expect(users).toHaveLength(5);
    for (const u of users) {
      const planned = world.learners.find((l) => l.email === u.email);
      expect(u.display_name).toBe(planned?.displayName);
    }

    const ids = await demoUserIds();
    const groups = await db<{ id: string; pack_slug: string }[]>`
      select id, pack_slug from public.groups where created_by = any(${ids}::uuid[])`;
    expect(groups).toHaveLength(1);
    const group = groups[0];
    expect(group?.pack_slug).toBe("ccdv-f");
    const members = await db<{ user_id: string; role: string }[]>`
      select user_id, role from public.group_members where group_id = ${group?.id ?? ""}`;
    expect(members).toHaveLength(6);
    expect(members.find((m) => m.user_id === YOU.id)?.role).toBe("admin");

    for (const learner of world.learners) {
      const [row] = await db<{ n: number }[]>`
        select count(*)::int as n from public.attempts a join auth.users u on u.id = a.user_id
        where lower(u.email) = ${learner.email}`;
      expect(row?.n).toBe(
        world.attempts.filter((t) => t.email === learner.email).length,
      );
    }

    const [maintainer] = await db<{ is_analogy_owner: boolean }[]>`
      select is_analogy_owner from private.content_maintainers
      where lower(email) = ${YOU.email} and pack_slug = 'ccdv-f'`;
    expect(maintainer?.is_analogy_owner).toBe(true);

    const heatmap = groupHeatmapFromAttempts({
      ...(await fetchGroupAttempts(admin, group?.id ?? "", YOU.id)),
      pack,
      now: new Date(),
    });
    expect(heatmap.status).not.toBe("not-enough-data");

    expect(await outsiderSnapshot()).toEqual(before);
  });

  it("SC-5: reviews follow review_item's rules; ≥ 1 approved and ≥ 1 flagged; your review queue is not empty", async () => {
    const ids = await demoUserIds();
    const reviews = await db<
      {
        item_id: string;
        reviewer_id: string;
        reviewer_email: string;
        author_email: string | null;
        review_hash: string;
        item_hash: string;
        verdict: string;
        comment: string | null;
      }[]
    >`
      select r.item_id, r.reviewer_id, lower(u.email) as reviewer_email,
             lower(i.author_email) as author_email, r.content_hash as review_hash,
             i.content_hash as item_hash, r.verdict, r.comment
      from private.item_reviews r
      join auth.users u on u.id = r.reviewer_id
      join private.items i on i.item_id = r.item_id
      where r.reviewer_id = any(${ids}::uuid[])`;
    expect(reviews.length).toBeGreaterThan(0);
    for (const r of reviews) {
      expect(r.reviewer_email).not.toBe(r.author_email);
      expect(r.review_hash).toBe(r.item_hash);
      if (r.verdict === "flag")
        expect(r.comment?.trim().length).toBeGreaterThan(0);
      const [answered] = await db<{ n: number }[]>`
        select count(*)::int as n from public.attempts
        where user_id = ${r.reviewer_id} and question_id = ${r.item_id}`;
      expect(answered?.n).toBe(0);
    }

    const reviewed = [...new Set(reviews.map((r) => r.item_id))];
    const states = await db<{ state: string }[]>`
      select private.item_state(id) as state from unnest(${reviewed}::text[]) as id`;
    expect(
      states.filter((s) => s.state === "approved").length,
    ).toBeGreaterThanOrEqual(1);
    expect(
      states.filter((s) => s.state === "flagged").length,
    ).toBeGreaterThanOrEqual(1);

    const { data, error } = await YOU.client.rpc("list_reviewable", {
      p_pack_slug: "ccdv-f",
    });
    expect(error).toBeNull();
    expect(Array.isArray(data) && data.length > 0).toBe(true);
  });

  it("SC-6: a second run gives the same counts and leaves a non-demo user untouched", async () => {
    const before = await counts();
    const outsiderBefore = await outsiderSnapshot();
    expect(before).toMatchObject({
      users: 5,
      groups: 1,
      members: 6,
      maintainers: 1,
    });

    await seedDemoWorld({
      sql: db,
      admin,
      world,
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: first,
    });

    const after = await counts();
    expect(after.users).toBe(5);
    expect(after.groups).toBe(1);
    expect(after.members).toBe(6);
    expect(after.reviews).toBe(before.reviews);
    expect(after.maintainers).toBe(1);
    // demo users are recreated (new ids), so compare attempt counts as a multiset
    expect(after.attempts.map((a) => a.n).sort()).toEqual(
      before.attempts.map((a) => a.n).sort(),
    );
    expect(await outsiderSnapshot()).toEqual(outsiderBefore);
  });
});
