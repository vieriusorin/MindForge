/**
 * MF-0052 SC-11: `fetchRecentStorms` through a learner's own (RLS-bound) client. Newest first, at
 * most 5, finished only, own storms only, one pack only, questions in storm order.
 * Runs against the LOCAL stack (pnpm test:db). Fixtures are written as the local superuser.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Database } from "@/server/db/database.types";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";
import { fetchRecentStorms } from "../fetch-recent-storms";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "ccdv-f";
const OTHER_PACK = "prod-prompting";

let A: TestUser; // the learner reading
let B: TestUser; // someone else

/** A's six finished ccdv-f storms, oldest first; T5 and T6 share finished_at (tie → id desc). */
const A_STORMS = [
  { id: crypto.randomUUID(), finishedAt: "2026-10-01T09:00:00.000Z" },
  { id: crypto.randomUUID(), finishedAt: "2026-10-02T09:00:00.000Z" },
  { id: crypto.randomUUID(), finishedAt: "2026-10-03T09:00:00.000Z" },
  { id: crypto.randomUUID(), finishedAt: "2026-10-04T09:00:00.000Z" },
  { id: crypto.randomUUID(), finishedAt: "2026-10-05T09:00:00.000Z" },
  { id: crypto.randomUUID(), finishedAt: "2026-10-05T09:00:00.000Z" },
];
const A_UNFINISHED = crypto.randomUUID();
const A_OTHER_PACK = crypto.randomUUID();
const B_STORM = crypto.randomUUID();

interface StormFixture {
  id: string;
  userId: string;
  packSlug: string;
  finishedAt: string | null;
  kind?: "full" | "boss";
}

async function insertStorm(
  db: ReturnType<typeof sql>,
  s: StormFixture,
): Promise<void> {
  const kind = s.kind ?? "full";
  const domain = kind === "boss" ? "D1" : null;
  // started 1 h before it finished (or now, when still running)
  await db`
    insert into public.storms (id, user_id, pack_slug, kind, domain_code, started_at, ends_at, finished_at)
    values (${s.id}, ${s.userId}, ${s.packSlug}, ${kind}, ${domain},
            coalesce(${s.finishedAt}::timestamptz, now()) - interval '1 hour',
            coalesce(${s.finishedAt}::timestamptz, now()) + interval '1 hour',
            ${s.finishedAt}::timestamptz)`;
  // written out of position order, so the read has to sort them
  await db`
    insert into public.storm_questions
      (storm_id, user_id, position, question_id, skill_code, domain_code, content_hash, unreviewed,
       chosen, chosen_at, correct, voided)
    values
      (${s.id}, ${s.userId}, 2, ${`${s.id}-q2`}, 'D1.S2', 'D1', 'h', false, null, null, null, false),
      (${s.id}, ${s.userId}, 1, ${`${s.id}-q1`}, 'D1.S1', 'D1', 'h', false,
       array['A'], coalesce(${s.finishedAt}::timestamptz, now()) - interval '30 minutes', true, false)`;
}

beforeAll(async () => {
  [A, B] = await Promise.all(
    ["a", "b"].map((n) =>
      createTestUser(`mf0052-recent-${n}-${RUN}@example.test`),
    ),
  );
  const db = sql();
  try {
    for (const [i, s] of A_STORMS.entries()) {
      await insertStorm(db, {
        ...s,
        userId: A.id,
        packSlug: PACK,
        kind: i === 4 ? "boss" : "full",
      });
    }
    await insertStorm(db, {
      id: A_UNFINISHED,
      userId: A.id,
      packSlug: PACK,
      finishedAt: null,
    });
    await insertStorm(db, {
      id: A_OTHER_PACK,
      userId: A.id,
      packSlug: OTHER_PACK,
      finishedAt: "2026-10-30T09:00:00.000Z",
    });
    await insertStorm(db, {
      id: B_STORM,
      userId: B.id,
      packSlug: PACK,
      finishedAt: "2026-10-31T09:00:00.000Z",
    });
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  const ids = [A, B].filter(Boolean).map((u) => u.id);
  const db = sql();
  try {
    // child first: questions, then storms, then the users
    await db`delete from public.storm_questions where user_id = any(${ids}::uuid[])`;
    await db`delete from public.storms where user_id = any(${ids}::uuid[])`;
  } finally {
    await db.end();
  }
  await Promise.all(ids.map((id) => deleteTestUser(id)));
});

describe("fetchRecentStorms (DB, RLS)", () => {
  it("returns your 5 newest finished storms of the pack, newest first (tie on finished_at → id desc)", async () => {
    const storms = await fetchRecentStorms(
      A.client as SupabaseClient<Database>,
      A.id,
      PACK,
    );
    const [t5, t6] = [A_STORMS[4], A_STORMS[5]];
    if (!t5 || !t6) throw new Error("fixture");
    const tied = [t5.id, t6.id].sort().reverse();
    expect(storms.map((s) => s.id)).toEqual([
      ...tied,
      A_STORMS[3]?.id,
      A_STORMS[2]?.id,
      A_STORMS[1]?.id,
    ]);
  });

  it("excludes the unfinished storm, the other pack's storm and another learner's storm", async () => {
    const ids = (
      await fetchRecentStorms(
        A.client as SupabaseClient<Database>,
        A.id,
        PACK,
        10,
      )
    ).map((s) => s.id);
    expect(ids).toHaveLength(6);
    expect(ids).not.toContain(A_UNFINISHED);
    expect(ids).not.toContain(A_OTHER_PACK);
    expect(ids).not.toContain(B_STORM);
  });

  it("never shows another learner's storm, even when asked for their id (RLS)", async () => {
    const storms = await fetchRecentStorms(
      A.client as SupabaseClient<Database>,
      B.id,
      PACK,
    );
    expect(storms).toEqual([]);
  });

  it("maps each storm with kind, domain, finishedAt and its questions in position order", async () => {
    const boss = A_STORMS[4];
    if (!boss) throw new Error("fixture");
    const storms = await fetchRecentStorms(
      A.client as SupabaseClient<Database>,
      A.id,
      PACK,
    );
    expect(storms.find((s) => s.id === boss.id)).toEqual({
      id: boss.id,
      kind: "boss",
      domainCode: "D1",
      finishedAt: boss.finishedAt,
      questions: [
        {
          id: `${boss.id}-q1`,
          skillCode: "D1.S1",
          chosen: ["A"],
          correct: true,
          voided: false,
        },
        {
          id: `${boss.id}-q2`,
          skillCode: "D1.S2",
          chosen: null,
          correct: null,
          voided: false,
        },
      ],
    });
  });
});
