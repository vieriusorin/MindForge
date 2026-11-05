/**
 * MF-0013 acceptance (DB half): the storm deadline, ownership, version check and start checks
 * (SC-3), no key before the end (SC-4), and grading into attempts at finish (SC-5).
 * Runs against the LOCAL stack (pnpm test:db) with real user tokens. `it` blocks share the
 * fixture in order. Every "refused" assertion first proves the call exists and the storm started,
 * so a missing function can never pass as a refusal.
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
const FUNCTIONS = [
  "public.start_storm(text,text,text,jsonb)",
  "public.answer_storm_question(uuid,text,text[],text)",
  "public.finish_storm(uuid)",
];

interface Item {
  question_id: string;
  skill_code: string;
  content_hash: string;
  correct_options: string[];
}

let L: TestUser; // the learner
let X: TestUser; // another signed-in learner
let Y: TestUser; // a learner used for the start checks
let D2: Item[] = []; // 3 synced D2 questions
let D1: Item | undefined; // 1 synced D1 question
let D2_13: { question_id: string; content_hash: string }[] = []; // 13 D2 questions (all of D2 today)
let STORM_ID = "";
let Q3_ORIGINAL_HASH = "";

const entry = (i: Item) => ({
  question_id: i.question_id,
  content_hash: i.content_hash,
});

async function start(
  client: SupabaseClient,
  kind: string,
  domain: string | null,
  questions: { question_id: string; content_hash: string }[],
) {
  return client.rpc("start_storm", {
    p_pack_slug: PACK,
    p_kind: kind,
    p_domain_code: domain,
    p_questions: questions,
  });
}

async function answer(
  client: SupabaseClient,
  item: Item,
  chosen: string[],
  hash = item.content_hash,
) {
  return client.rpc("answer_storm_question", {
    p_storm_id: STORM_ID,
    p_question_id: item.question_id,
    p_chosen: chosen,
    p_content_hash: hash,
  });
}

/** A wrong answer: any letter not in the key. */
const wrongFor = (item: Item): string[] => [
  ["A", "B", "C", "D", "E"].find((o) => !item.correct_options.includes(o)) ??
    "Z",
];

beforeAll(async () => {
  const db = sql();
  try {
    const rows = await db<(Item & { playable: boolean })[]>`
      select k.question_id, k.skill_code, i.content_hash, k.correct_options,
        private.item_state(i.item_id) not in ('flagged', 'rejected') as playable
      from private.question_keys k
      join private.items i on i.item_id = k.question_id
      where k.pack_slug = ${PACK}
      order by k.question_id`;
    // ccdv-f ships 53 questions (D2 has 13); the fixture needs 13 of D2
    if (rows.filter((r) => r.skill_code.startsWith("D2.")).length < 13)
      throw new Error("ccdv-f not synced: run pnpm db:sync-keys");
    // MF-0052 re-freeze: questions the storm actually plays must be playable (start_storm refuses a
    // flagged or rejected item), so a seeded local DB (pnpm dev:seed flags one ccdv-f question) can't
    // turn this red. D2_13 keeps every D2 question: the 12-question cap is checked before playability.
    const playable = rows.filter((r) => r.playable);
    D2 = playable.filter((r) => r.skill_code.startsWith("D2.")).slice(0, 3);
    D1 = playable.find((r) => r.skill_code.startsWith("D1."));
    D2_13 = rows
      .filter((r) => r.skill_code.startsWith("D2."))
      .slice(0, 13)
      .map(entry);
    [L, X, Y] = await Promise.all(
      ["l", "x", "y"].map((n) =>
        createTestUser(`mf0013-${n}-${RUN}@example.test`),
      ),
    );
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  const db = sql();
  try {
    const q3 = D2[2];
    if (q3 && Q3_ORIGINAL_HASH) {
      await db`update private.items set content_hash = ${Q3_ORIGINAL_HASH}
               where item_id = ${q3.question_id}`;
    }
  } finally {
    await db.end();
  }
  // users cascade to their storms, storm questions and attempts
  await Promise.all([L, X, Y].filter(Boolean).map((u) => deleteTestUser(u.id)));
});

describe("MF-0013 storms (DB)", () => {
  it("SC-3: the storm RPCs exist; a learner starts a Boss Storm and the DB sets the clock", async () => {
    const db = sql();
    try {
      for (const fn of FUNCTIONS) {
        const [row] = await db<{ ok: boolean }[]>`
          select to_regprocedure(${fn}) is not null as ok`;
        expect(row?.ok, fn).toBe(true);
      }
    } finally {
      await db.end();
    }

    const started = await start(L.client, "boss", "D2", D2.map(entry));
    expect(started.error).toBeNull();
    STORM_ID = String(started.data);

    const storm = await L.client
      .from("storms")
      .select("kind, domain_code, started_at, ends_at, finished_at")
      .eq("id", STORM_ID)
      .single();
    expect(storm.error).toBeNull();
    expect(storm.data?.kind).toBe("boss");
    expect(storm.data?.domain_code).toBe("D2");
    expect(storm.data?.finished_at).toBeNull();
    const seconds =
      (Date.parse(storm.data?.ends_at) - Date.parse(storm.data?.started_at)) /
      1000;
    // ceil(3 × 7200 / 53) = ceil(407.55) = 408
    expect(seconds).toBe(408);
  });

  it("SC-3: a second running storm is refused", async () => {
    expect(STORM_ID).not.toBe("");
    const second = await start(L.client, "boss", "D2", D2.map(entry));
    expect(second.error).not.toBeNull();
  });

  it("SC-3: another learner can neither read nor answer nor finish my storm", async () => {
    expect(STORM_ID).not.toBe("");
    const [q1] = D2;
    if (!q1) throw new Error("fixture");
    const read = await X.client.from("storms").select("id").eq("id", STORM_ID);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    const questions = await X.client
      .from("storm_questions")
      .select("question_id")
      .eq("storm_id", STORM_ID);
    expect(questions.error).toBeNull();
    expect(questions.data).toEqual([]);
    expect(
      (await answer(X.client, q1, q1.correct_options)).error,
    ).not.toBeNull();
    const finish = await X.client.rpc("finish_storm", { p_storm_id: STORM_ID });
    expect(finish.error).not.toBeNull();
  });

  it("SC-3: an answer naming another content hash is refused; the right one is accepted", async () => {
    expect(STORM_ID).not.toBe("");
    const [q1] = D2;
    if (!q1) throw new Error("fixture");
    const stale = await answer(
      L.client,
      q1,
      q1.correct_options,
      "not-the-hash",
    );
    expect(stale.error).not.toBeNull();
    const ok = await answer(L.client, q1, wrongFor(q1));
    expect(ok.error).toBeNull();
    // skip and return: the answer may change until the end
    const changed = await answer(L.client, q1, q1.correct_options);
    expect(changed.error).toBeNull();
  });

  it("SC-3: the DB refuses a storm it did not plan: wrong domain, a repeated question, more than 12 in a Boss Storm, unknown hash", async () => {
    const [q1] = D2;
    if (!q1 || !D1) throw new Error("fixture");
    // control: a valid start for Y works, so the refusals below are the checks, not a missing RPC
    const valid = await start(Y.client, "boss", "D2", [entry(q1)]);
    expect(valid.error).toBeNull();
    const finish = await Y.client.rpc("finish_storm", {
      p_storm_id: String(valid.data),
    });
    expect(finish.error).toBeNull();

    const mixed = await start(Y.client, "boss", "D2", [entry(q1), entry(D1)]);
    expect(mixed.error).not.toBeNull();
    const repeated = await start(Y.client, "boss", "D2", [
      entry(q1),
      entry(q1),
    ]);
    expect(repeated.error).not.toBeNull();
    const boss13 = await start(Y.client, "boss", "D2", D2_13);
    expect(boss13.error).not.toBeNull();
    const badHash = await start(Y.client, "boss", "D2", [
      { question_id: q1.question_id, content_hash: "not-the-hash" },
    ]);
    expect(badHash.error).not.toBeNull();
  });

  it("SC-4: before the end, nothing the learner can read holds a key or a grade", async () => {
    expect(STORM_ID).not.toBe("");
    const [q1, , q3] = D2;
    if (!q1 || !q3) throw new Error("fixture");
    const answered = await answer(L.client, q3, q3.correct_options);
    expect(answered.error).toBeNull();
    expect(answered.data || null).toBeNull();

    const rows = await L.client
      .from("storm_questions")
      .select("*")
      .eq("storm_id", STORM_ID);
    expect(rows.error).toBeNull();
    expect(rows.data).toHaveLength(3);
    for (const row of rows.data ?? []) {
      expect(row.correct).toBeNull();
      expect(Object.keys(row)).not.toContain("correct_options");
      expect(Object.keys(row)).not.toContain("rationale");
    }
    const storm = await L.client
      .from("storms")
      .select("*")
      .eq("id", STORM_ID)
      .single();
    expect(storm.error).toBeNull();
    expect(JSON.stringify(storm.data)).not.toMatch(/correct|rationale/i);
  });

  it("SC-3: after ends_at an answer is refused", async () => {
    expect(STORM_ID).not.toBe("");
    const [, q2, q3] = D2;
    if (!q2 || !q3) throw new Error("fixture");
    const db = sql();
    try {
      // q3's content changes while the storm runs (a sync): it must be voided at finish
      const [row] = await db<{ content_hash: string }[]>`
        select content_hash from private.items where item_id = ${q3.question_id}`;
      Q3_ORIGINAL_HASH = row?.content_hash ?? "";
      await db`update private.items set content_hash = ${`mf0013-${RUN}`}
               where item_id = ${q3.question_id}`;
      await db`update public.storms
               set started_at = now() - interval '1 hour',
                   ends_at = now() - interval '1 second'
               where id = ${STORM_ID}`;
    } finally {
      await db.end();
    }
    const late = await answer(L.client, q2, q2.correct_options);
    expect(late.error).not.toBeNull();
  });

  it("SC-5: at finish each answered, unvoided question becomes one attempt graded by the DB key", async () => {
    expect(STORM_ID).not.toBe("");
    const [q1, q2, q3] = D2;
    if (!q1 || !q2 || !q3) throw new Error("fixture");
    const finished = await L.client.rpc("finish_storm", {
      p_storm_id: STORM_ID,
    });
    expect(finished.error).toBeNull();

    const rows = await L.client
      .from("storm_questions")
      .select("question_id, chosen, correct, voided")
      .eq("storm_id", STORM_ID);
    expect(rows.error).toBeNull();
    const byId = new Map((rows.data ?? []).map((r) => [r.question_id, r]));
    expect(byId.get(q1.question_id)).toMatchObject({
      correct: true,
      voided: false,
    });
    expect(byId.get(q2.question_id)).toMatchObject({
      chosen: null,
      correct: null,
      voided: false,
    });
    expect(byId.get(q3.question_id)).toMatchObject({
      correct: null,
      voided: true,
    });

    const attempts = await L.client
      .from("attempts")
      .select("question_id, correct, storm_id, chosen")
      .eq("storm_id", STORM_ID);
    expect(attempts.error).toBeNull();
    expect(attempts.data).toEqual([
      {
        question_id: q1.question_id,
        correct: true,
        storm_id: STORM_ID,
        chosen: q1.correct_options,
      },
    ]);

    const storm = await L.client
      .from("storms")
      .select("finished_at")
      .eq("id", STORM_ID)
      .single();
    expect(storm.data?.finished_at).not.toBeNull();

    // finished: a new storm may start
    const next = await start(L.client, "boss", "D2", [entry(q1)]);
    expect(next.error).toBeNull();
  });
});
