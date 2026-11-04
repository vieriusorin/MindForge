/**
 * MF-0013 (T1): storm finalisation and the private skill map, beyond the frozen acceptance test.
 * Lazy finalisation of expired storms, idempotent finish, start after expiry, private.pack_skills
 * unreadable by learners, and an answer refused once the registry hash moved.
 * Runs against the LOCAL stack (pnpm test:db). Expiry is simulated by moving ends_at as the
 * local superuser (C-6: no test clock in app code). Each case uses its own learner.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "ccdv-f";

interface Item {
  question_id: string;
  content_hash: string;
  correct_options: string[];
}

let D1: Item[] = []; // 2 synced D1 questions
let A: TestUser; // (a) expired storm finalised lazily
let B: TestUser; // (b) running storm left alone
let C: TestUser; // (c) finish twice
let D: TestUser; // (d) start after expiry
let E: TestUser; // (e) private.pack_skills
let F: TestUser; // (f) registry hash moved
let G: TestUser; // (g) cleared answer, (h) null inputs refused
let F_ORIGINAL_HASH = "";

const entry = (i: Item) => ({
  question_id: i.question_id,
  content_hash: i.content_hash,
});

async function startBoss(
  client: SupabaseClient,
  items: Item[],
): Promise<string> {
  const { data, error } = await client.rpc("start_storm", {
    p_pack_slug: PACK,
    p_kind: "boss",
    p_domain_code: "D1",
    p_questions: items.map(entry),
  });
  if (error) throw error;
  return String(data);
}

async function answer(
  client: SupabaseClient,
  stormId: string,
  item: Item,
  hash = item.content_hash,
) {
  return client.rpc("answer_storm_question", {
    p_storm_id: stormId,
    p_question_id: item.question_id,
    p_chosen: item.correct_options,
    p_content_hash: hash,
  });
}

/** Move a storm's deadline into the past, as the local superuser. */
async function expire(stormId: string): Promise<void> {
  const db = sql();
  try {
    await db`update public.storms
             set started_at = now() - interval '1 hour',
                 ends_at = now() - interval '1 second'
             where id = ${stormId}`;
  } finally {
    await db.end();
  }
}

async function stormRow(stormId: string) {
  const db = sql();
  try {
    const [row] = await db<{ ends_at: Date; finished_at: Date | null }[]>`
      select ends_at, finished_at from public.storms where id = ${stormId}`;
    return row;
  } finally {
    await db.end();
  }
}

async function attemptCount(stormId: string): Promise<number> {
  const db = sql();
  try {
    const [row] = await db<{ n: number }[]>`
      select count(*)::int as n from public.attempts where storm_id = ${stormId}`;
    return row?.n ?? -1;
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  const db = sql();
  try {
    D1 = await db<Item[]>`
      select k.question_id, i.content_hash, k.correct_options
      from private.question_keys k
      join private.items i on i.item_id = k.question_id
      join private.pack_skills s on s.pack_slug = k.pack_slug and s.skill_code = k.skill_code
      where k.pack_slug = ${PACK} and s.domain_code = 'D1'
      order by k.question_id
      limit 2`;
    if (D1.length < 2)
      throw new Error("ccdv-f not synced: run pnpm db:sync-keys");
  } finally {
    await db.end();
  }
  [A, B, C, D, E, F, G] = await Promise.all(
    ["a", "b", "c", "d", "e", "f", "g"].map((n) =>
      createTestUser(`mf0013-fin-${n}-${RUN}@example.test`),
    ),
  );
});

afterAll(async () => {
  const db = sql();
  try {
    const [q] = D1;
    if (q && F_ORIGINAL_HASH) {
      await db`update private.items set content_hash = ${F_ORIGINAL_HASH}
               where item_id = ${q.question_id}`;
    }
  } finally {
    await db.end();
  }
  // users cascade to their storms, storm questions and attempts
  await Promise.all(
    [A, B, C, D, E, F, G].filter(Boolean).map((u) => deleteTestUser(u.id)),
  );
});

describe("MF-0013 storm finalisation (DB)", () => {
  it("(a) finalize_expired_storms finishes an expired storm at ends_at and writes its attempts", async () => {
    const [q1] = D1;
    if (!q1) throw new Error("fixture");
    const stormId = await startBoss(A.client, D1);
    expect((await answer(A.client, stormId, q1)).error).toBeNull();
    await expire(stormId);

    const { error } = await A.client.rpc("finalize_expired_storms");
    expect(error).toBeNull();

    const row = await stormRow(stormId);
    expect(row?.finished_at).not.toBeNull();
    expect(row?.finished_at?.getTime()).toBe(row?.ends_at.getTime());
    // q1 answered -> one attempt; q2 unanswered -> none (C-3)
    const attempts = await A.client
      .from("attempts")
      .select("question_id, correct, storm_id")
      .eq("storm_id", stormId);
    expect(attempts.error).toBeNull();
    expect(attempts.data).toEqual([
      { question_id: q1.question_id, correct: true, storm_id: stormId },
    ]);
  });

  it("(b) finalize_expired_storms leaves a storm inside its deadline untouched", async () => {
    const [q1] = D1;
    if (!q1) throw new Error("fixture");
    const stormId = await startBoss(B.client, D1);
    expect((await answer(B.client, stormId, q1)).error).toBeNull();

    const { error } = await B.client.rpc("finalize_expired_storms");
    expect(error).toBeNull();

    expect((await stormRow(stormId))?.finished_at).toBeNull();
    expect(await attemptCount(stormId)).toBe(0);
    const rows = await B.client
      .from("storm_questions")
      .select("correct")
      .eq("storm_id", stormId);
    expect(rows.data?.every((r) => r.correct === null)).toBe(true);
    // still answerable
    expect((await answer(B.client, stormId, q1)).error).toBeNull();
  });

  it("(c) finishing twice writes the attempts once", async () => {
    const [q1, q2] = D1;
    if (!q1 || !q2) throw new Error("fixture");
    const stormId = await startBoss(C.client, D1);
    expect((await answer(C.client, stormId, q1)).error).toBeNull();
    expect((await answer(C.client, stormId, q2)).error).toBeNull();

    const first = await C.client.rpc("finish_storm", { p_storm_id: stormId });
    expect(first.error).toBeNull();
    const finishedAt = (await stormRow(stormId))?.finished_at?.getTime();
    expect(finishedAt).toBeDefined();
    const second = await C.client.rpc("finish_storm", { p_storm_id: stormId });
    expect(second.error).toBeNull();

    expect(await attemptCount(stormId)).toBe(2);
    expect((await stormRow(stormId))?.finished_at?.getTime()).toBe(finishedAt);
    // the storm is over: answers are refused
    const late = await answer(C.client, stormId, q1);
    expect(late.error?.code).toBe("MF013");
  });

  it("(d) start_storm after expiry finalises the old storm and starts a new one", async () => {
    const [q1] = D1;
    if (!q1) throw new Error("fixture");
    const oldId = await startBoss(D.client, [q1]);
    expect((await answer(D.client, oldId, q1)).error).toBeNull();
    await expire(oldId);

    const newId = await startBoss(D.client, [q1]);
    expect(newId).not.toBe(oldId);

    const old = await stormRow(oldId);
    expect(old?.finished_at?.getTime()).toBe(old?.ends_at.getTime());
    expect(await attemptCount(oldId)).toBe(1);
    expect((await stormRow(newId))?.finished_at).toBeNull();
  });

  it("(e) a signed-in learner cannot read private.pack_skills", async () => {
    const db = sql();
    try {
      // control: the superuser sees the synced map, so the refusal below is the grant, not an empty table
      const [row] = await db<{ n: number }[]>`
        select count(*)::int as n from private.pack_skills where pack_slug = ${PACK}`;
      expect(row?.n).toBeGreaterThan(0);

      const refused = await db
        .begin(async (tx) => {
          await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: E.id, role: "authenticated" })}, true)`;
          await tx`set local role authenticated`;
          await tx`select skill_code from private.pack_skills limit 1`;
        })
        .then(
          () => "read",
          (error: { code?: string }) => error.code ?? "error",
        );
      expect(refused).toBe("42501");
    } finally {
      await db.end();
    }

    const api = await E.client
      .schema("private")
      .from("pack_skills")
      .select("skill_code");
    expect(api.error).not.toBeNull();
    expect(api.data ?? []).toEqual([]);
  });

  // q2 only: (f) moves q1's registry hash
  it("(g) an empty answer clears a saved one: no attempt, chosen null", async () => {
    const [, q2] = D1;
    if (!q2) throw new Error("fixture");
    const stormId = await startBoss(G.client, [q2]);
    const saved = await G.client.rpc("answer_storm_question", {
      p_storm_id: stormId,
      p_question_id: q2.question_id,
      p_chosen: ["A"],
      p_content_hash: q2.content_hash,
    });
    expect(saved.error).toBeNull();
    const cleared = await G.client.rpc("answer_storm_question", {
      p_storm_id: stormId,
      p_question_id: q2.question_id,
      p_chosen: [],
      p_content_hash: q2.content_hash,
    });
    expect(cleared.error).toBeNull();

    const finished = await G.client.rpc("finish_storm", {
      p_storm_id: stormId,
    });
    expect(finished.error).toBeNull();
    expect(await attemptCount(stormId)).toBe(0);
    const rows = await G.client
      .from("storm_questions")
      .select("chosen, correct")
      .eq("storm_id", stormId);
    expect(rows.data).toEqual([{ chosen: null, correct: null }]);
  });

  it("(h) a null answer and missing questions are refused with 22023", async () => {
    const [, q2] = D1;
    if (!q2) throw new Error("fixture");
    const noQuestions = await G.client.rpc("start_storm", {
      p_pack_slug: PACK,
      p_kind: "full",
    });
    expect(noQuestions.error?.code).toBe("22023");
    const emptyQuestions = await G.client.rpc("start_storm", {
      p_pack_slug: PACK,
      p_kind: "full",
      p_questions: [],
    });
    expect(emptyQuestions.error?.code).toBe("22023");

    const stormId = await startBoss(G.client, [q2]);
    const nullAnswer = await G.client.rpc("answer_storm_question", {
      p_storm_id: stormId,
      p_question_id: q2.question_id,
      p_chosen: null,
      p_content_hash: q2.content_hash,
    });
    expect(nullAnswer.error?.code).toBe("22023");
  });

  it("(f) an answer naming the stored hash is refused after the registry hash changed", async () => {
    const [q1] = D1;
    if (!q1) throw new Error("fixture");
    const stormId = await startBoss(F.client, D1);
    // control: the stored hash is accepted while the registry agrees
    expect((await answer(F.client, stormId, q1)).error).toBeNull();

    const db = sql();
    try {
      F_ORIGINAL_HASH = q1.content_hash;
      await db`update private.items set content_hash = ${`mf0013-fin-${RUN}`}
               where item_id = ${q1.question_id}`;
    } finally {
      await db.end();
    }

    const stale = await answer(F.client, stormId, q1);
    expect(stale.error?.code).toBe("55000");
  });
});
