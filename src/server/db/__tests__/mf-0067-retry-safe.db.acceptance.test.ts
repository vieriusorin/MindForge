/**
 * MF-0067 acceptance (SC-1..SC-7): `record_attempt` is retry-safe. A repeat with the same client attempt id
 * returns the first grade and writes nothing; the same id with another answer is refused (23505); two
 * concurrent calls with one id leave one row; the FSRS replay counts one review. Runs against the LOCAL stack
 * (`pnpm test:db`). Seeds its own pack slug in private.question_keys + private.items; deletes child-first.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { replayMemory } from "@/engine/memory";
import type { Database } from "@/server/db/database.types";
import { fetchAttempts } from "@/server/memory/fetch-attempts";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "mf0067-test";
const q = (name: string): string => `${PACK}.S1.${RUN}.${name}`;
const Q1 = q("q1"); // key [B], hash H1
const Q2 = q("q2"); // key [A], hash H2
const QK = q("key"); // key [A] → [B] between two calls (SC-2)
const QH = q("hash"); // hash qh-old → qh-new between two calls (SC-2)
const QC = q("race"); // concurrency (SC-5)
const QF = q("fsrs"); // replay (SC-6)
const QL = q("legacy"); // no id (SC-7)
const H1 = "h1-mf0067";
const H2 = "h2-mf0067";
let A: TestUser;
let B: TestUser;

interface RpcOutcome {
  data: unknown;
  code: string | null;
}

async function rec(
  user: TestUser,
  args: {
    question: string;
    chosen: string[];
    hash: string | null;
    id?: string;
  },
): Promise<RpcOutcome> {
  const res = await user.client.rpc("record_attempt", {
    p_question_id: args.question,
    p_chosen: args.chosen,
    p_content_hash: args.hash,
    ...(args.id === undefined ? {} : { p_client_attempt_id: args.id }),
  });
  return { data: res.data, code: res.error?.code ?? null };
}

interface Row {
  id: string;
  correct: boolean;
  chosen: string[];
  answered_at: Date;
  client_attempt_id: string | null;
}

async function rowsOf(userId: string, question: string): Promise<Row[]> {
  const db = sql();
  try {
    return await db<Row[]>`
      select id::text as id, correct, chosen, answered_at, client_attempt_id::text as client_attempt_id
      from public.attempts
      where user_id = ${userId} and question_id = ${question}
      order by id`;
  } finally {
    await db.end();
  }
}

async function clean(): Promise<void> {
  const db = sql();
  try {
    await db`delete from public.attempts where pack_slug = ${PACK}`;
    await db`delete from private.items where pack_slug = ${PACK}`;
    await db`delete from private.question_keys where pack_slug = ${PACK}`;
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  await clean();
  A = await createTestUser(`mf0067-a-${RUN}@test.local`);
  B = await createTestUser(`mf0067-b-${RUN}@test.local`);
  const db = sql();
  try {
    await db`
      insert into private.question_keys (question_id, pack_slug, skill_code, correct_options) values
        (${Q1}, ${PACK}, 'S1', ${["B"]}),
        (${Q2}, ${PACK}, 'S1', ${["A"]}),
        (${QK}, ${PACK}, 'S1', ${["A"]}),
        (${QH}, ${PACK}, 'S1', ${["A"]}),
        (${QC}, ${PACK}, 'S1', ${["B"]}),
        (${QF}, ${PACK}, 'S1', ${["B"]}),
        (${QL}, ${PACK}, 'S1', ${["B"]})`;
    await db`
      insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin) values
        (${Q1}, ${PACK}, 'S1', 'question', ${H1}, 'official'),
        (${Q2}, ${PACK}, 'S1', 'question', ${H2}, 'official'),
        (${QK}, ${PACK}, 'S1', 'question', 'qk', 'official'),
        (${QH}, ${PACK}, 'S1', 'question', 'qh-old', 'official'),
        (${QC}, ${PACK}, 'S1', 'question', 'qc', 'official'),
        (${QF}, ${PACK}, 'S1', 'question', 'qf', 'official'),
        (${QL}, ${PACK}, 'S1', 'question', 'ql', 'official')`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  for (const u of [A, B]) if (u) await deleteTestUser(u.id);
});

// Shared across SC-1..SC-4: A's first answer to Q1 under this id.
const ID1 = randomUUID();

describe("MF-0067 record_attempt is retry-safe", () => {
  it("SC-1: a first call with a new id grades as before and stores the id on one row", async () => {
    expect(
      await rec(A, { question: Q1, chosen: ["B"], hash: H1, id: ID1 }),
    ).toEqual({ data: true, code: null });
    const rows = await rowsOf(A.id, Q1);
    expect(rows.map((r) => [r.correct, r.client_attempt_id])).toEqual([
      [true, ID1],
    ]);
  });

  it("SC-2: a repeat with the same id and answer returns the first grade and writes nothing", async () => {
    const before = await rowsOf(A.id, Q1);
    expect(
      await rec(A, { question: Q1, chosen: ["B"], hash: H1, id: ID1 }),
    ).toEqual({ data: true, code: null });
    // a retry that sends no hash is still the same answer
    expect(
      await rec(A, { question: Q1, chosen: ["B"], hash: null, id: ID1 }),
    ).toEqual({ data: true, code: null });
    const after = await rowsOf(A.id, Q1);
    expect(after).toHaveLength(1);
    expect(after[0]?.id).toBe(before[0]?.id);
    expect(after[0]?.answered_at.toISOString()).toBe(
      before[0]?.answered_at.toISOString(),
    );

    // a wrong first answer stays wrong
    const wrong = randomUUID();
    expect(
      await rec(A, { question: Q2, chosen: ["B"], hash: H2, id: wrong }),
    ).toEqual({ data: false, code: null });
    expect(
      await rec(A, { question: Q2, chosen: ["B"], hash: H2, id: wrong }),
    ).toEqual({ data: false, code: null });
    expect(await rowsOf(A.id, Q2)).toHaveLength(1);
  });

  it("SC-2: a repeat after the key changed returns the first grade, not a re-grade", async () => {
    const id = randomUUID();
    expect(
      await rec(A, { question: QK, chosen: ["B"], hash: "qk", id }),
    ).toEqual({ data: false, code: null });
    const db = sql();
    try {
      await db`update private.question_keys set correct_options = ${["B"]} where question_id = ${QK}`;
    } finally {
      await db.end();
    }
    expect(
      await rec(A, { question: QK, chosen: ["B"], hash: "qk", id }),
    ).toEqual({ data: false, code: null });
    // control: a NEW answer is graded on the new key, so the key really changed
    expect(
      await rec(A, {
        question: QK,
        chosen: ["B"],
        hash: "qk",
        id: randomUUID(),
      }),
    ).toEqual({ data: true, code: null });
    expect((await rowsOf(A.id, QK)).map((r) => r.correct)).toEqual([
      false,
      true,
    ]);
  });

  it("SC-2: a repeat after the registry hash changed returns the first grade, not 55000", async () => {
    const id = randomUUID();
    expect(
      await rec(A, { question: QH, chosen: ["A"], hash: "qh-old", id }),
    ).toEqual({ data: true, code: null });
    const db = sql();
    try {
      await db`update private.items set content_hash = 'qh-new' where item_id = ${QH}`;
    } finally {
      await db.end();
    }
    expect(
      await rec(A, { question: QH, chosen: ["A"], hash: "qh-old", id }),
    ).toEqual({ data: true, code: null });
    // control: a NEW answer on the old version is refused, so the registry really moved
    expect(
      await rec(A, {
        question: QH,
        chosen: ["A"],
        hash: "qh-old",
        id: randomUUID(),
      }),
    ).toEqual({ data: null, code: "55000" });
    expect(await rowsOf(A.id, QH)).toHaveLength(1);
  });

  it("SC-3: the same id with another question, answer or hash is refused (23505) and writes nothing", async () => {
    const before = await rowsOf(A.id, Q1);
    const q2Before = await rowsOf(A.id, Q2);
    expect(
      await rec(A, { question: Q2, chosen: ["A"], hash: H2, id: ID1 }),
    ).toEqual({ data: null, code: "23505" });
    expect(
      await rec(A, { question: Q1, chosen: ["A"], hash: H1, id: ID1 }),
    ).toEqual({ data: null, code: "23505" });
    expect(
      await rec(A, { question: Q1, chosen: ["A", "B"], hash: H1, id: ID1 }),
    ).toEqual({ data: null, code: "23505" });
    expect(
      await rec(A, { question: Q1, chosen: ["B"], hash: "other", id: ID1 }),
    ).toEqual({ data: null, code: "23505" });
    expect(await rowsOf(A.id, Q1)).toEqual(before);
    expect(await rowsOf(A.id, Q2)).toEqual(q2Before);
  });

  it("SC-4: another learner sending the same id gets their own grade and row", async () => {
    const aBefore = await rowsOf(A.id, Q1);
    expect(
      await rec(B, { question: Q1, chosen: ["A"], hash: H1, id: ID1 }),
    ).toEqual({ data: false, code: null });
    expect(
      (await rowsOf(B.id, Q1)).map((r) => [r.correct, r.client_attempt_id]),
    ).toEqual([[false, ID1]]);
    expect(await rowsOf(A.id, Q1)).toEqual(aBefore);
    const seen = await B.client
      .from("attempts")
      .select("user_id, correct")
      .eq("question_id", Q1);
    expect([seen.error, seen.data]).toEqual([
      null,
      [{ user_id: B.id, correct: false }],
    ]);
  });

  it("SC-5: two concurrent calls with one id leave one row; the second waits for the first's commit", async () => {
    const id = randomUUID();
    const db = sql();
    let isReleased = false;
    let first: boolean | null = null;
    let second:
      | PromiseLike<RpcOutcome & { isReleasedAtResponse: boolean }>
      | undefined;
    try {
      await db.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: A.id, role: "authenticated" })}, true)`;
        await tx`set local role authenticated`;
        const [row] = await tx<{ correct: boolean }[]>`
          select public.record_attempt(${QC}::text, ${["B"]}::text[], 'qc'::text, ${id}::uuid) as correct`;
        first = row?.correct ?? null;
        // Started now (`.then` sends the request) while the first insert is uncommitted.
        second = A.client
          .rpc("record_attempt", {
            p_question_id: QC,
            p_chosen: ["B"],
            p_content_hash: "qc",
            p_client_attempt_id: id,
          })
          .then((r) => ({
            data: r.data,
            code: r.error?.code ?? null,
            isReleasedAtResponse: isReleased,
          }));
        await new Promise((resolve) => setTimeout(resolve, 750));
        isReleased = true; // COMMIT is sent after this callback returns
      });
    } finally {
      await db.end();
    }
    expect(first).toBe(true);
    expect(await second).toEqual({
      data: true,
      code: null,
      isReleasedAtResponse: true,
    });
    expect(
      (await rowsOf(A.id, QC)).map((r) => [r.correct, r.client_attempt_id]),
    ).toEqual([[true, id]]);
  });

  it("SC-6: the FSRS replay counts one review for a repeated id, two for two ids", async () => {
    const id = randomUUID();
    await rec(A, { question: QF, chosen: ["B"], hash: "qf", id });
    await rec(A, { question: QF, chosen: ["B"], hash: "qf", id });
    const client = A.client as SupabaseClient<Database>;
    const once = (await fetchAttempts(client, A.id, PACK)).filter(
      (a) => a.questionId === QF,
    );
    expect(once).toHaveLength(1);
    expect(replayMemory(once, new Date())?.successfulRecalls).toBe(1);

    await rec(A, { question: QF, chosen: ["B"], hash: "qf", id: randomUUID() });
    const twice = (await fetchAttempts(client, A.id, PACK)).filter(
      (a) => a.questionId === QF,
    );
    expect(replayMemory(twice, new Date())?.successfulRecalls).toBe(2);
  });

  it("SC-7: only the 5-arg signature exists (MF-0065 appends p_confidence); the column, unique key and grants are as specified", async () => {
    const db = sql();
    try {
      const sigs = await db<{ sig: string; auth: boolean; anon: boolean }[]>`
        select p.oid::regprocedure::text as sig,
               has_function_privilege('authenticated', p.oid, 'execute') as auth,
               has_function_privilege('anon', p.oid, 'execute') as anon
        from pg_proc p
        where p.proname = 'record_attempt'
        order by 1`;
      expect(sigs).toEqual([
        {
          sig: "private.record_attempt(text,text[],text,uuid,text)",
          auth: true,
          anon: false,
        },
        {
          sig: "record_attempt(text,text[],text,uuid,text)",
          auth: true,
          anon: false,
        },
      ]);

      const cols = await db<{ data_type: string; is_nullable: string }[]>`
        select data_type, is_nullable from information_schema.columns
        where table_schema = 'public' and table_name = 'attempts' and column_name = 'client_attempt_id'`;
      expect(cols).toEqual([{ data_type: "uuid", is_nullable: "YES" }]);

      const uniques = await db<{ cols: string[] }[]>`
        select array_agg(a.attname::text order by k.ord) as cols
        from pg_index i
        cross join lateral unnest(i.indkey) with ordinality as k(attnum, ord)
        join pg_attribute a on a.attrelid = i.indrelid and a.attnum = k.attnum
        where i.indrelid = 'public.attempts'::regclass and i.indisunique
        group by i.indexrelid`;
      expect(uniques.map((u) => u.cols)).toContainEqual([
        "user_id",
        "client_attempt_id",
      ]);

      const [grants] = await db<{ ins: boolean; upd: boolean; del: boolean }[]>`
        select has_table_privilege('authenticated', 'public.attempts', 'INSERT') as ins,
               has_table_privilege('authenticated', 'public.attempts', 'UPDATE') as upd,
               has_table_privilege('authenticated', 'public.attempts', 'DELETE') as del`;
      expect(grants).toEqual({ ins: false, upd: false, del: false });
    } finally {
      await db.end();
    }

    // legacy path: no id → a row per call, id null
    await rec(A, { question: QL, chosen: ["B"], hash: "ql" });
    await rec(A, { question: QL, chosen: ["B"], hash: "ql" });
    expect((await rowsOf(A.id, QL)).map((r) => r.client_attempt_id)).toEqual([
      null,
      null,
    ]);
  });
});
