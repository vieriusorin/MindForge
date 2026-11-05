/**
 * MF-0034 review findings (REVIEW.md note 1 and delta notes 1-2), against the LOCAL stack: a world
 * that cannot be seeded (pack not registered, stale registry, rejected item, self-review, a learner
 * off the demo domain) is refused before anything is deleted, so the previous demo world AND your
 * previously seeded answers survive. Shown RED on the code before each fix.
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
const DEMO = `mf0034r-${RUN}.test`;
const db = sql();
const admin = adminClient();
let YOU: TestUser;
let good: DemoWorld;
let first: SeedManifest;

async function demoState() {
  const users = await db<{ id: string }[]>`
    select id from auth.users where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`}`;
  const [groups] = await db<{ n: number }[]>`
    select count(*)::int as n from public.groups
    where created_by = any(${users.map((u) => u.id)}::uuid[])`;
  const [seeded] = await db<{ n: number }[]>`
    select count(*)::int as n from public.attempts
    where id = any(${first?.youAttemptIds ?? []}::bigint[])`;
  return {
    userIds: users.map((u) => u.id).sort(),
    groups: groups?.n,
    yourSeededAnswers: seeded?.n,
  };
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
  first = await seedDemoWorlds({
    sql: db,
    admin,
    worlds: [good],
    demoDomain: DEMO,
    youEmail: YOU.email,
    previous: null,
  });
});

/** A refused run must leave the demo world and your seeded answers exactly as they were. */
async function expectRefusedKeepingWorld(
  worlds: DemoWorld[],
  message: RegExp,
): Promise<void> {
  // the "your answers survive" half is meaningful only if the fixture seeded some (delta review 2, note 1)
  expect(first.youAttemptIds.length).toBeGreaterThan(0);
  const before = await demoState();
  expect(before.groups).toBe(1);
  expect(before.yourSeededAnswers).toBe(first.youAttemptIds.length);
  await expect(
    seedDemoWorlds({
      sql: db,
      admin,
      worlds,
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: first,
    }),
  ).rejects.toThrow(message);
  expect(await demoState()).toEqual(before);
}

afterAll(async () => {
  const { userIds } = await demoState();
  for (const id of userIds) await admin.auth.admin.deleteUser(id);
  await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
  await db`delete from private.flag_resolutions where comment = ${`mf0034r ${RUN}`}`;
  if (YOU) await deleteTestUser(YOU.id);
  await db.end();
});

describe("MF-0034 review regressions", () => {
  it("an unregistered pack is refused before anything is deleted", async () => {
    const unregistered: DemoWorld = {
      ...good,
      group: { ...good.group, packSlug: `missing-${RUN}` },
    };
    await expectRefusedKeepingWorld([good, unregistered], /not registered/);
  });

  it("a stale review registry is refused before anything is deleted", async () => {
    const [head, ...rest] = good.reviews;
    if (!head) throw new Error("fixture: the plan has no reviews");
    await expectRefusedKeepingWorld(
      [
        {
          ...good,
          reviews: [{ ...head, contentHash: "0".repeat(64) }, ...rest],
        },
      ],
      /stale/,
    );
  });

  it("a review of its own item is refused before anything is deleted", async () => {
    const [head, ...rest] = good.reviews;
    if (!head) throw new Error("fixture: the plan has no reviews");
    const [item] = await db<{ author_email: string }[]>`
      select author_email from private.items where item_id = ${head.itemId}`;
    if (!item?.author_email)
      throw new Error("fixture: reviewed item has no author");
    await expectRefusedKeepingWorld(
      [
        {
          ...good,
          reviews: [{ ...head, reviewerEmail: item.author_email }, ...rest],
        },
      ],
      /review their own item/,
    );
  });

  it("a learner off the demo domain is refused before anything is deleted", async () => {
    const learners = good.learners.map((l) =>
      l.persona === "steady"
        ? { ...l, email: `steady-${RUN}@elsewhere.test` }
        : l,
    );
    await expectRefusedKeepingWorld(
      [{ ...good, learners }],
      /not on the demo domain/,
    );
  });

  it("a review of a rejected item is refused before anything is deleted", async () => {
    const review = good.reviews.find((r) => r.verdict === "flag");
    if (!review) throw new Error("fixture: the plan has no flag");
    await db`
      insert into private.flag_resolutions (item_id, content_hash, action, comment, resolved_by)
      values (${review.itemId}, ${review.contentHash}, 'reject', ${`mf0034r ${RUN}`}, ${YOU.id})`;
    await expectRefusedKeepingWorld([good], /rejected/);
  });
});
