/**
 * MF-0068 acceptance (frozen, DB half): the path scenarios written to the LOCAL stack (pnpm test:db) through
 * the one seeder, twice, then read back. Run-scoped emails, so the developer's own data is never touched;
 * `it` blocks share the fixture in order. Expected values are literals from .planning/tasks/MF-0068/GOAL.md.
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildForest } from "@/engine/forest";
import { memoryBySkill } from "@/engine/memory";
import type { Pack } from "@/engine/pack";
import { type PathContent, parsePath, pathProgress } from "@/engine/path";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorld } from "../plan-demo-world";
import { planPathScenarios } from "../plan-path-scenarios";
import { listSeedExcludedItems, seedDemoWorlds } from "../seed-demo-world";
import type { DemoWorld, PathScenarioPlan, SeedManifest } from "../types";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const DEMO = `mf0068-${RUN}.test`;
const PATH_SLUG = "claude-developer";
const COURSES = [
  "ai-capabilities",
  "platform-foundations",
  "claude-code-in-action",
  "agent-skills",
  "subagents",
] as const;
const PERSONAS = [
  "fresh",
  "halfway",
  "midpath",
  "finisher",
  "lapsed-path",
  "crammer-path",
] as const;
type Persona = (typeof PERSONAS)[number];
const COMPLETIONS: Record<Persona, number> = {
  fresh: 0,
  halfway: 0,
  midpath: 2,
  finisher: 5,
  "lapsed-path": 1,
  "crammer-path": 0,
};
const NS = "not-started";
const IP = "in-progress";
const C = "complete";
const STATUSES: Record<Persona, string[]> = {
  fresh: [NS, NS, NS, NS, NS],
  halfway: [IP, NS, NS, NS, NS],
  midpath: [C, C, IP, NS, NS],
  finisher: [C, C, C, C, C],
  "lapsed-path": [C, IP, NS, NS, NS],
  "crammer-path": [IP, NS, NS, NS, NS],
};
const HAND = {
  enrolledAt: "2026-10-01T09:00:00.000Z",
  completedAt: "2026-10-02T09:00:00.000Z",
  answeredAt: "2026-10-03T09:00:00.000Z",
  completedPack: "agent-skills",
};

const db = sql();
const admin = adminClient();
let YOU: TestUser;
let path: PathContent;
let packs: Map<string, Pack>;
let world: DemoWorld;
let plan: PathScenarioPlan;
let first: SeedManifest;
let handAttemptId: string;

const emailOf = (p: Persona): string => `${p}@${DEMO}`;

async function demoUsers(): Promise<{ id: string; email: string }[]> {
  return db<{ id: string; email: string }[]>`
    select id, lower(email) as email from auth.users
    where right(lower(email), ${DEMO.length + 1}) = ${`@${DEMO}`} order by id`;
}

async function pathGroups(): Promise<
  { id: string; name: string; pack_slug: string; members: number }[]
> {
  const ids = (await demoUsers()).map((u) => u.id);
  return db<{ id: string; name: string; pack_slug: string; members: number }[]>`
    select g.id, g.name, g.pack_slug, count(m.user_id)::int as members
    from public.groups g join public.group_members m on m.group_id = g.id
    where g.path_slug = ${PATH_SLUG} and g.created_by = any(${ids}::uuid[])
    group by g.id order by g.name`;
}

async function readBack(email: string) {
  const [user] = await db<{ id: string }[]>`
    select id from auth.users where lower(email) = ${email}`;
  if (!user) throw new Error(`no user ${email}`);
  const enrollments = await db<{ path_slug: string }[]>`
    select path_slug from public.path_enrollments where user_id = ${user.id}`;
  const completions = await db<
    { pack_slug: string; completed_at: Date; pack_version: number }[]
  >`
    select pack_slug, completed_at, pack_version from public.course_completions
    where user_id = ${user.id} order by pack_slug`;
  const attempts = await db<
    {
      pack_slug: string;
      question_id: string;
      skill_code: string;
      correct: boolean;
      answered_at: Date;
    }[]
  >`
    select pack_slug, question_id, skill_code, correct, answered_at
    from public.attempts where user_id = ${user.id} order by answered_at, id`;
  const now = new Date();
  const forests = new Map(
    COURSES.map((slug) => {
      const pack = packs.get(slug);
      if (!pack) throw new Error(`no pack ${slug}`);
      return [
        slug,
        buildForest(
          pack,
          memoryBySkill(
            attempts
              .filter((a) => a.pack_slug === slug)
              .map((a) => ({
                questionId: a.question_id,
                skillCode: a.skill_code,
                correct: a.correct,
                answeredAt: new Date(a.answered_at),
              })),
            now,
          ),
        ),
      ] as const;
    }),
  );
  const progress = pathProgress({
    path,
    completions: completions.map((c) => ({
      packSlug: c.pack_slug,
      completedAt: new Date(c.completed_at).toISOString(),
      packVersion: c.pack_version,
    })),
    forests,
  });
  return { enrollments, completions, attempts, progress };
}

async function assertSeededState(): Promise<void> {
  expect(await demoUsers()).toHaveLength(5 + 6);
  for (const persona of PERSONAS) {
    const got = await readBack(emailOf(persona));
    expect(got.enrollments.map((e) => e.path_slug)).toEqual([PATH_SLUG]);
    expect(got.completions).toHaveLength(COMPLETIONS[persona]);
    expect(got.attempts).toHaveLength(
      plan.attempts.filter((t) => t.email === emailOf(persona)).length,
    );
    expect(got.progress.courses.map((c) => c.status)).toEqual(
      STATUSES[persona],
    );
  }
  const groups = await pathGroups();
  expect(groups.map((g) => [g.name, g.pack_slug, g.members])).toEqual([
    ["Demo path group · Claude Developer", "ai-capabilities", 6],
    ["Demo path trio · Claude Developer", "ai-capabilities", 3],
  ]);
}

async function yourPathRows() {
  const enrollments = await db<{ path_slug: string; started_at: Date }[]>`
    select path_slug, started_at from public.path_enrollments where user_id = ${YOU.id}`;
  const completions = await db<{ pack_slug: string; completed_at: Date }[]>`
    select pack_slug, completed_at from public.course_completions where user_id = ${YOU.id}`;
  const [groups] = await db<{ n: number }[]>`
    select count(*)::int as n from public.group_members m
    join public.groups g on g.id = m.group_id
    where m.user_id = ${YOU.id} and g.path_slug is not null`;
  const [hand] = await db<{ n: number }[]>`
    select count(*)::int as n from public.attempts
    where id = ${handAttemptId}::bigint and user_id = ${YOU.id}
      and answered_at = ${HAND.answeredAt}::timestamptz`;
  return {
    enrollments: enrollments.map((e) => [
      e.path_slug,
      new Date(e.started_at).toISOString(),
    ]),
    completions: completions.map((c) => [
      c.pack_slug,
      new Date(c.completed_at).toISOString(),
    ]),
    pathGroups: groups?.n ?? -1,
    handAnswer: hand?.n ?? -1,
  };
}

const YOUR_HAND_ROWS = {
  enrollments: [[PATH_SLUG, HAND.enrolledAt]],
  completions: [[HAND.completedPack, HAND.completedAt]],
  pathGroups: 0,
  handAnswer: 1,
};

beforeAll(async () => {
  YOU = await createTestUser(`you-${RUN}@mf0068.test`);
  path = parsePath(
    await readFile(join(process.cwd(), "paths", `${PATH_SLUG}.yaml`), "utf8"),
  );
  const inputs = new Map(
    await Promise.all(
      COURSES.map(
        async (slug) =>
          [
            slug,
            await loadSeedInputs(join(process.cwd(), "packs", slug)),
          ] as const,
      ),
    ),
  );
  packs = new Map([...inputs].map(([slug, i]) => [slug, i.pack]));
  const ai = inputs.get("ai-capabilities");
  if (!ai) throw new Error("ai-capabilities not loaded");
  const now = new Date();
  const excludeItemIds = await listSeedExcludedItems(db, {
    demoDomain: DEMO,
    youEmail: YOU.email,
  });
  world = planDemoWorld({
    now,
    seed: 42,
    packSlug: "ai-capabilities",
    youEmail: YOU.email,
    demoDomain: DEMO,
    questions: ai.questions,
    items: ai.items,
    excludeItemIds,
  });

  // Your hand-played path state: the seed owns none of it.
  const question = ai.questions[0];
  if (!question) throw new Error("ai-capabilities has no question");
  await db`
    insert into public.path_enrollments (user_id, path_slug, started_at)
    values (${YOU.id}, ${PATH_SLUG}, ${HAND.enrolledAt})`;
  await db`
    insert into public.course_completions (user_id, pack_slug, completed_at, pack_version)
    values (${YOU.id}, ${HAND.completedPack}, ${HAND.completedAt}, 1)`;
  const [hand] = await db<{ id: string }[]>`
    insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at)
    values (${YOU.id}, 'ai-capabilities', ${question.skillCode}, ${question.questionId},
            ${question.correctOptions}, true, ${HAND.answeredAt})
    returning id::text`;
  if (!hand) throw new Error("hand-played answer not inserted");
  handAttemptId = hand.id;

  plan = planPathScenarios({
    now,
    seed: 42,
    youEmail: YOU.email,
    demoDomain: DEMO,
    path,
    courses: [...inputs.values()].map((i) => ({
      pack: i.pack,
      questions: i.questions,
    })),
    excludeItemIds,
  });
});

afterAll(async () => {
  for (const { id } of await demoUsers()) await admin.auth.admin.deleteUser(id);
  if (YOU) {
    await db`delete from private.content_maintainers where lower(email) = ${YOU.email}`;
    await deleteTestUser(YOU.id);
  }
  await db.end();
});

describe("MF-0068 path scenarios (seeded)", () => {
  it("SC-6: two runs each leave the planned personas, completions, answers and path groups; read back through the engine", async () => {
    first = await seedDemoWorlds({
      sql: db,
      admin,
      worlds: [world],
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: null,
      paths: plan,
    });
    await assertSeededState();
    await seedDemoWorlds({
      sql: db,
      admin,
      worlds: [world],
      demoDomain: DEMO,
      youEmail: YOU.email,
      previous: first,
      paths: plan,
    });
    await assertSeededState();
  });

  it("SC-7: your account holds only your hand-made path rows after two runs", async () => {
    expect(await yourPathRows()).toEqual(YOUR_HAND_ROWS);
  });

  it("SC-8: an unseedable path plan, or one naming you, is refused before any delete", async () => {
    const usersBefore = await demoUsers();
    const groupsBefore = (await pathGroups()).map((g) => g.id);
    expect(groupsBefore).toHaveLength(2);
    const completionsBefore = (await readBack(emailOf("finisher"))).completions
      .length;

    const reordered: PathScenarioPlan = {
      ...plan,
      path: { ...plan.path, courses: [...plan.path.courses].reverse() },
    };
    await expect(
      seedDemoWorlds({
        sql: db,
        admin,
        worlds: [world],
        demoDomain: DEMO,
        youEmail: YOU.email,
        previous: null,
        paths: reordered,
      }),
    ).rejects.toThrow(/db:sync-keys/);

    const naming: PathScenarioPlan = {
      ...plan,
      enrollments: [
        ...plan.enrollments,
        { email: YOU.email, pathSlug: PATH_SLUG, startedAt: new Date() },
      ],
    };
    await expect(
      seedDemoWorlds({
        sql: db,
        admin,
        worlds: [world],
        demoDomain: DEMO,
        youEmail: YOU.email,
        previous: null,
        paths: naming,
      }),
    ).rejects.toThrow();

    expect(await demoUsers()).toEqual(usersBefore);
    expect((await pathGroups()).map((g) => g.id)).toEqual(groupsBefore);
    expect((await readBack(emailOf("finisher"))).completions).toHaveLength(
      completionsBefore,
    );
    expect(await yourPathRows()).toEqual(YOUR_HAND_ROWS);
  });
});
