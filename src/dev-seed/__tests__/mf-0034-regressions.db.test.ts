/**
 * MF-0034 review finding (REVIEW.md note 1), against the LOCAL stack: a pack that cannot be seeded
 * (not registered, or a stale review registry) must be refused before anything is deleted, so the
 * previous demo world survives. Shown RED on the code before its fix.
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
import type { DemoWorld } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0034r-${RUN}.test`;
const db = sql();
const admin = adminClient();
let YOU: TestUser;
let good: DemoWorld;

async function demoState() {
  const users = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
  const [groups] = await db<{ n: number }[]>`
    select count(*)::int as n from public.groups
    where created_by = any(${users.map((u) => u.id)}::uuid[])`;
  return { userIds: users.map((u) => u.id).sort(), groups: groups?.n };
}

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0034r.test`);
  const inputs = await loadSeedInputs(
    join(process.cwd(), "packs/prod-prompting"),
  );
  good = planDemoWorld({
    now: new Date("2026-11-04T12:00:00Z"),
    seed: 42,
    packSlug: "prod-prompting",
    youEmail: YOU.email,
    demoDomain: DEMO,
    questions: inputs.questions,
    items: inputs.items,
  });
  await seedDemoWorlds({
    sql: db,
    admin,
    worlds: [good],
    demoDomain: DEMO,
    youEmail: YOU.email,
    previous: null,
  });
});

afterAll(async () => {
  const { userIds } = await demoState();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0034 review regressions", () => {
  it("an unregistered pack is refused before the previous demo world is deleted", async () => {
    const before = await demoState();
    expect(before.groups).toBe(1);
    const unregistered: DemoWorld = {
      ...good,
      group: { ...good.group, packSlug: `missing-${RUN}` },
    };
    await expect(
      seedDemoWorlds({
        sql: db,
        admin,
        worlds: [good, unregistered],
        demoDomain: DEMO,
        youEmail: YOU.email,
        previous: null,
      }),
    ).rejects.toThrow(/not registered/);
    expect(await demoState()).toEqual(before);
  });

  it("a stale review registry is refused before the previous demo world is deleted", async () => {
    const before = await demoState();
    const [first, ...rest] = good.reviews;
    if (!first) throw new Error("fixture: the plan has no reviews");
    const stale: DemoWorld = {
      ...good,
      reviews: [{ ...first, contentHash: "0".repeat(64) }, ...rest],
    };
    await expect(
      seedDemoWorlds({
        sql: db,
        admin,
        worlds: [stale],
        demoDomain: DEMO,
        youEmail: YOU.email,
        previous: null,
      }),
    ).rejects.toThrow(/stale/);
    expect(await demoState()).toEqual(before);
  });
});
