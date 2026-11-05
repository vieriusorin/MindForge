/**
 * MF-0034 acceptance (frozen, DB half): two pack worlds sharing one set of demo learners, written to the
 * LOCAL stack (pnpm test:db). Run-scoped emails, so the developer's own data is never touched; `it`
 * blocks share the fixture in order. Expected values are literals from .planning/tasks/MF-0034/GOAL.md.
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
import { planDemoWorld } from "../plan-demo-world";
import { seedDemoWorlds } from "../seed-demo-world";
import type { DemoWorld, SeedManifest } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0034-${RUN}.test`;
const PACKS = ["ccdv-f", "prod-prompting"] as const;

let YOU: TestUser;
let worlds: DemoWorld[];
let first: SeedManifest;
const db = sql();
const admin = adminClient();

async function demoUserIds(): Promise<string[]> {
  const rows = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
  return rows.map((r) => r.id);
}

async function demoGroups() {
  const ids = await demoUserIds();
  return db<
    {
      pack_slug: string;
      name: string;
      members: number;
      you_role: string | null;
    }[]
  >`
    select g.pack_slug, g.name, count(m.user_id)::int as members,
      max(case when m.user_id = ${YOU.id} then m.role end) as you_role
    from public.groups g join public.group_members m on m.group_id = g.id
    where g.created_by = any(${ids}::uuid[])
    group by g.id, g.pack_slug, g.name order by g.pack_slug`;
}

async function perPack() {
  const ids = await demoUserIds();
  const attempts = await db<{ pack_slug: string; n: number }[]>`
    select pack_slug, count(*)::int as n from public.attempts
    where user_id = any(${[...ids, YOU.id]}::uuid[]) group by pack_slug order by pack_slug`;
  const approvals = await db<{ pack_slug: string; n: number }[]>`
    select i.pack_slug, count(*)::int as n from private.item_reviews r
    join private.items i on i.item_id = r.item_id
    where r.reviewer_id = any(${ids}::uuid[]) and r.verdict = 'approve'
    group by i.pack_slug order by i.pack_slug`;
  const owner = await db<{ pack_slug: string }[]>`
    select pack_slug from private.content_maintainers
    where lower(email) = ${YOU.email} and is_analogy_owner order by pack_slug`;
  return { attempts, approvals, owner: owner.map((o) => o.pack_slug) };
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0034.test`);
  worlds = [];
  for (const slug of PACKS) {
    const inputs = await loadSeedInputs(join(process.cwd(), "packs", slug));
    worlds.push(
      planDemoWorld({
        now: new Date(),
        seed: 42,
        packSlug: slug,
        groupName: `Demo ${slug}`,
        youEmail: YOU.email,
        demoDomain: DEMO,
        questions: inputs.questions,
        items: inputs.items,
      }),
    );
  }
});

afterAll(async () => {
  for (const id of await demoUserIds()) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0034 demo seed for every pack", () => {
  it("SC-4: 5 demo users, one named group of 6 per pack with you as admin, attempts + approvals in both, you analogy owner of both", async () => {
    first = await seedDemoWorlds({
      sql: db,
      admin,
      worlds,
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: null,
    });
    expect(await demoUserIds()).toHaveLength(5);
    expect(await demoGroups()).toEqual([
      {
        pack_slug: "ccdv-f",
        name: "Demo ccdv-f",
        members: 6,
        you_role: "admin",
      },
      {
        pack_slug: "prod-prompting",
        name: "Demo prod-prompting",
        members: 6,
        you_role: "admin",
      },
    ]);
    const p = await perPack();
    expect(p.attempts.map((a) => a.pack_slug)).toEqual([...PACKS]);
    for (const a of p.attempts) expect(a.n).toBeGreaterThan(0);
    expect(p.approvals.map((a) => a.pack_slug)).toEqual([...PACKS]);
    expect(p.owner).toEqual([...PACKS]);
    expect(first.youAttemptIds.length).toBeGreaterThan(0);
  });

  it("SC-5: a re-run keeps the counts and your hand-played answer; a narrowed run leaves one demo group", async () => {
    const before = await perPack();
    const [hand] = await db<{ id: string }[]>`
      insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
      values (${YOU.id}, 'prod-prompting', 'D1.S1', 'prod-prompting.D1.S1.q1', ${["A"]}, false, now())
      returning id::text`;

    const second = await seedDemoWorlds({
      sql: db,
      admin,
      worlds,
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: first,
    });
    expect(await demoUserIds()).toHaveLength(5);
    expect((await demoGroups()).map((g) => g.pack_slug)).toEqual([...PACKS]);
    const after = await perPack();
    // the hand-played answer is the only extra row
    expect(after.attempts).toEqual(
      before.attempts.map((a) =>
        a.pack_slug === "prod-prompting" ? { ...a, n: a.n + 1 } : a,
      ),
    );
    const [kept] =
      await db`select id from public.attempts where id = ${hand?.id ?? "0"}`;
    expect(kept).toBeDefined();

    await seedDemoWorlds({
      sql: db,
      admin,
      worlds: worlds.filter((w) => w.group.packSlug === "prod-prompting"),
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: second,
    });
    expect((await demoGroups()).map((g) => g.pack_slug)).toEqual([
      "prod-prompting",
    ]);
    const [stillKept] =
      await db`select id from public.attempts where id = ${hand?.id ?? "0"}`;
    expect(stillKept).toBeDefined();
  });
});
