/**
 * MF-0058 acceptance (SC-4, DB half): after a graded attempt that brings the pack's last skill to
 * Sapling, the recorder leaves exactly one `public.course_completions` row for (user, pack) with the
 * pack's `version`; a second qualifying attempt doesn't add or change it; an attempt that leaves a
 * skill below Sapling writes nothing. LOCAL stack only (pnpm test:db). The `it` blocks run in order.
 *
 * Facades (they can't run outside Next): the pack file read (`getPack`, "use cache") returns a
 * fixture course pack with version 7; the secret client is the local stack's secret-key client; the
 * per-request server client is the learner's signed-in client. Everything below them (attempts,
 * replay, the rule, the write) runs for real.
 *
 * Fixture memory (FSRS, no fuzz): S1 answered right 20 and 10 days ago (Sapling, stability ≈ 25 d);
 * S2 answered right 3 days ago (Sprout, stability ≈ 2.3 d). One more right answer on S2 now takes it
 * past 3 days (Sapling). The table doesn't exist before the ticket's migration: the teardown
 * tolerates that.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Pack } from "@/engine/pack";
import {
  adminClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const { current } = vi.hoisted(() => ({
  current: { client: null as unknown },
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/secret", () => ({
  createSecretSupabase: () => adminClient(),
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => current.client,
}));
vi.mock("@/server/packs/get-pack", () => ({
  getPack: async (slug: string): Promise<Pack> => {
    if (slug !== PACK) throw new Error(`unexpected pack ${slug}`);
    return FIXTURE_PACK;
  },
}));

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "mf0058-course";
const VERSION = 7;
const Q1 = `${PACK}.S1.q1`;
const Q2 = `${PACK}.S2.q1`;
const HASH = "h-mf0058";
const DAY = 86_400_000;

const FIXTURE_PACK: Pack = {
  slug: PACK,
  name: "MF-0058 course",
  kind: "course",
  version: VERSION,
  domains: [
    {
      code: "D1",
      name: "Domain",
      weight: 100,
      skills: [
        { code: "S1", name: "Skill one", weight: 50 },
        { code: "S2", name: "Skill two", weight: 50 },
      ],
    },
  ],
};

// after the fixture constants: the getPack mock reads them when the recorder loads
const { recordCourseCompletion } = await import(
  "@/server/paths/record-course-completion"
);

let A: TestUser;

async function tableExists(db: ReturnType<typeof sql>, name: string) {
  const [row] = await db<{ ok: boolean }[]>`
    select to_regclass(${name}) is not null as ok`;
  return row?.ok === true;
}

async function clean(): Promise<void> {
  const db = sql();
  try {
    // child-first: completions and attempts, then the registry rows
    if (await tableExists(db, "public.course_completions"))
      await db`delete from public.course_completions where pack_slug = ${PACK}`;
    await db`delete from public.attempts where pack_slug = ${PACK}`;
    await db`delete from private.items where pack_slug = ${PACK}`;
    await db`delete from private.question_keys where pack_slug = ${PACK}`;
  } finally {
    await db.end();
  }
}

/** Read as postgres: what the database holds, whatever the policies. */
async function completionsOf(userId: string) {
  const db = sql();
  try {
    return await db<{ pack_version: number; completed_at: Date }[]>`
      select pack_version, completed_at from public.course_completions
      where user_id = ${userId} and pack_slug = ${PACK}`;
  } finally {
    await db.end();
  }
}

/** A graded attempt, as the app makes it: the learner's own `record_attempt`. */
async function answerRight(questionId: string): Promise<void> {
  const res = await A.client.rpc("record_attempt", {
    p_question_id: questionId,
    p_chosen: ["B"],
    p_content_hash: HASH,
  });
  if (res.error || res.data !== true)
    throw new Error(`record_attempt: ${res.error?.message ?? res.data}`);
}

beforeAll(async () => {
  await clean();
  A = await createTestUser(`mf0058-sc4-${RUN}@test.local`);
  current.client = A.client;
  const db = sql();
  try {
    await db`
      insert into private.question_keys (question_id, pack_slug, skill_code, correct_options) values
        (${Q1}, ${PACK}, 'S1', ${["B"]}),
        (${Q2}, ${PACK}, 'S2', ${["B"]})`;
    await db`
      insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin) values
        (${Q1}, ${PACK}, 'S1', 'question', ${HASH}, 'official'),
        (${Q2}, ${PACK}, 'S2', 'question', ${HASH}, 'official')`;
    const now = Date.now();
    await db`
      insert into public.attempts (user_id, pack_slug, skill_code, question_id, chosen, correct, answered_at, content_hash) values
        (${A.id}, ${PACK}, 'S1', ${Q1}, ${["B"]}, true, ${new Date(now - 20 * DAY)}, ${HASH}),
        (${A.id}, ${PACK}, 'S1', ${Q1}, ${["B"]}, true, ${new Date(now - 10 * DAY)}, ${HASH}),
        (${A.id}, ${PACK}, 'S2', ${Q2}, ${["B"]}, true, ${new Date(now - 3 * DAY)}, ${HASH})`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  if (A) await deleteTestUser(A.id);
});

describe("MF-0058 SC-4: the recorder writes Course complete once", () => {
  it("SC-4: an attempt that leaves one skill below Sapling writes nothing", async () => {
    await answerRight(Q1); // S1 grows; S2 is still a Sprout
    await recordCourseCompletion({
      userId: A.id,
      packSlug: PACK,
      now: new Date(),
    });
    expect(await completionsOf(A.id)).toEqual([]);
  });

  it("SC-4: the attempt that brings the last skill to Sapling writes exactly one row with the pack's version", async () => {
    await answerRight(Q2); // S2 reaches Sapling: every skill is Sapling now
    await recordCourseCompletion({
      userId: A.id,
      packSlug: PACK,
      now: new Date(),
    });
    const rows = await completionsOf(A.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.pack_version).toBe(7);
  });

  it("SC-4: a second qualifying attempt neither adds nor changes the row", async () => {
    const before = await completionsOf(A.id);
    await answerRight(Q1);
    await recordCourseCompletion({
      userId: A.id,
      packSlug: PACK,
      now: new Date(),
    });
    const after = await completionsOf(A.id);
    expect(after).toHaveLength(1);
    expect(after).toEqual(before);
  });
});
