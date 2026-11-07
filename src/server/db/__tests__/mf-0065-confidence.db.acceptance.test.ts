/**
 * MF-0065 acceptance (SC-1, SC-2, SC-3, SC-7 DB part) — frozen. `record_attempt` stores the learner's
 * confidence tap with the grade, in the same call; the tap never changes the grade; a retry with another tap
 * is refused like any other answer change (23505, `is distinct from`); a replay is bound to the content hash
 * that graded it (MF-0067 review note 6); `group_attempts` never carries confidence. LOCAL stack only
 * (`pnpm test:db`). Seeds its own pack slug in private.question_keys + private.items; deletes child-first.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "mf0065-test";
const q = (name: string): string => `${PACK}.S1.${RUN}.${name}`;
const QS = q("store"); // key [B], hash hs (SC-1)
const QI = q("idem"); // key [B], hash hi (SC-2)
const QV = q("version"); // key [A] hash v1 → key [B] hash v2 (SC-3)
const QG = q("group"); // key [B] (SC-7)
let A: TestUser;
let B: TestUser;
let C: TestUser;
let D: TestUser;

interface RpcOutcome {
  data: unknown;
  code: string | null;
}

async function rec(
  user: TestUser,
  args: {
    question: string;
    chosen: string[];
    hash: string;
    id: string;
    confidence?: string | null;
  },
): Promise<RpcOutcome> {
  const res = await user.client.rpc("record_attempt", {
    p_question_id: args.question,
    p_chosen: args.chosen,
    p_content_hash: args.hash,
    p_client_attempt_id: args.id,
    ...(args.confidence === undefined ? {} : { p_confidence: args.confidence }),
  });
  return { data: res.data, code: res.error?.code ?? null };
}

interface Row {
  id: string;
  correct: boolean;
  confidence: string | null;
}

async function rowsOf(userId: string, question: string): Promise<Row[]> {
  const db = sql();
  try {
    return await db<Row[]>`
      select id::text as id, correct, confidence
      from public.attempts
      where user_id = ${userId} and question_id = ${question}
      order by id`;
  } finally {
    await db.end();
  }
}

let groupId: string | null = null;

async function clean(): Promise<void> {
  const db = sql();
  try {
    await db`delete from public.attempts where pack_slug = ${PACK}`;
    if (groupId) await db`delete from public.groups where id = ${groupId}`;
    await db`delete from private.items where pack_slug = ${PACK}`;
    await db`delete from private.question_keys where pack_slug = ${PACK}`;
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  await clean();
  A = await createTestUser(`mf0065-a-${RUN}@test.local`);
  B = await createTestUser(`mf0065-b-${RUN}@test.local`);
  C = await createTestUser(`mf0065-c-${RUN}@test.local`);
  D = await createTestUser(`mf0065-d-${RUN}@test.local`);
  const db = sql();
  try {
    await db`
      insert into private.question_keys (question_id, pack_slug, skill_code, correct_options) values
        (${QS}, ${PACK}, 'S1', ${["B"]}),
        (${QI}, ${PACK}, 'S1', ${["B"]}),
        (${QV}, ${PACK}, 'S1', ${["A"]}),
        (${QG}, ${PACK}, 'S1', ${["B"]})`;
    await db`
      insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin) values
        (${QS}, ${PACK}, 'S1', 'question', 'hs', 'official'),
        (${QI}, ${PACK}, 'S1', 'question', 'hi', 'official'),
        (${QV}, ${PACK}, 'S1', 'question', 'v1', 'official'),
        (${QG}, ${PACK}, 'S1', 'question', 'hg', 'official')`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  for (const u of [A, B, C, D]) if (u) await deleteTestUser(u.id);
});

describe("MF-0065 record_attempt stores confidence with the grade", () => {
  it("SC-1: only the 5-arg signature exists; the column is a nullable, checked text", async () => {
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
        where table_schema = 'public' and table_name = 'attempts' and column_name = 'confidence'`;
      expect(cols).toEqual([{ data_type: "text", is_nullable: "YES" }]);
      const [grants] = await db<{ ins: boolean; upd: boolean; del: boolean }[]>`
        select has_table_privilege('authenticated', 'public.attempts', 'INSERT') as ins,
               has_table_privilege('authenticated', 'public.attempts', 'UPDATE') as upd,
               has_table_privilege('authenticated', 'public.attempts', 'DELETE') as del`;
      expect(grants).toEqual({ ins: false, upd: false, del: false });
    } finally {
      await db.end();
    }
  });

  it("SC-1: sure / unsure are stored; the grade is the key's alone; no tap stores null", async () => {
    expect(
      await rec(A, {
        question: QS,
        chosen: ["B"],
        hash: "hs",
        id: randomUUID(),
        confidence: "sure",
      }),
    ).toEqual({ data: true, code: null });
    expect(
      await rec(A, {
        question: QS,
        chosen: ["B"],
        hash: "hs",
        id: randomUUID(),
        confidence: "unsure",
      }),
    ).toEqual({ data: true, code: null });
    expect(
      await rec(A, {
        question: QS,
        chosen: ["A"],
        hash: "hs",
        id: randomUUID(),
        confidence: "sure",
      }),
    ).toEqual({ data: false, code: null });
    expect(
      await rec(A, {
        question: QS,
        chosen: ["B"],
        hash: "hs",
        id: randomUUID(),
      }),
    ).toEqual({ data: true, code: null });
    expect(
      (await rowsOf(A.id, QS)).map((r) => [r.correct, r.confidence]),
    ).toEqual([
      [true, "sure"],
      [true, "unsure"],
      [false, "sure"],
      [true, null],
    ]);
  });

  it("SC-1: any other confidence is refused with 22023 and writes nothing", async () => {
    const before = await rowsOf(A.id, QS);
    for (const bad of ["SURE", "maybe", ""]) {
      expect(
        await rec(A, {
          question: QS,
          chosen: ["B"],
          hash: "hs",
          id: randomUUID(),
          confidence: bad,
        }),
      ).toEqual({ data: null, code: "22023" });
    }
    expect(await rowsOf(A.id, QS)).toEqual(before);
  });

  it("SC-2: same id + same confidence returns the first grade and writes nothing", async () => {
    const id = randomUUID();
    const first = { question: QI, chosen: ["A"], hash: "hi", id };
    expect(await rec(A, { ...first, confidence: "sure" })).toEqual({
      data: false,
      code: null,
    });
    expect(await rec(A, { ...first, confidence: "sure" })).toEqual({
      data: false,
      code: null,
    });
    expect((await rowsOf(A.id, QI)).map((r) => r.confidence)).toEqual(["sure"]);
  });

  it("SC-2: same id + another confidence, or null vs a value either way, is 23505 with no write", async () => {
    const sure = randomUUID();
    const none = randomUUID();
    const base = { question: QI, chosen: ["B"], hash: "hi" };
    expect(await rec(B, { ...base, id: sure, confidence: "sure" })).toEqual({
      data: true,
      code: null,
    });
    expect(await rec(B, { ...base, id: none })).toEqual({
      data: true,
      code: null,
    });
    const before = await rowsOf(B.id, QI);
    expect(await rec(B, { ...base, id: sure, confidence: "unsure" })).toEqual({
      data: null,
      code: "23505",
    });
    expect(await rec(B, { ...base, id: sure, confidence: null })).toEqual({
      data: null,
      code: "23505",
    });
    expect(await rec(B, { ...base, id: none, confidence: "sure" })).toEqual({
      data: null,
      code: "23505",
    });
    expect(await rowsOf(B.id, QI)).toEqual(before);
  });

  it("SC-3: a replay is bound to the content hash that graded it", async () => {
    const id = randomUUID();
    expect(
      await rec(A, {
        question: QV,
        chosen: ["A"],
        hash: "v1",
        id,
        confidence: "sure",
      }),
    ).toEqual({ data: true, code: null });
    const db = sql();
    try {
      await db`update private.question_keys set correct_options = ${["B"]} where question_id = ${QV}`;
      await db`update private.items set content_hash = 'v2' where item_id = ${QV}`;
    } finally {
      await db.end();
    }
    // the version the learner read (v1) → the first grade, graded by v1's key
    expect(
      await rec(A, {
        question: QV,
        chosen: ["A"],
        hash: "v1",
        id,
        confidence: "sure",
      }),
    ).toEqual({ data: true, code: null });
    // a page showing v2 can never replay a v1 grade (its key would disagree)
    expect(
      await rec(A, {
        question: QV,
        chosen: ["A"],
        hash: "v2",
        id,
        confidence: "sure",
      }),
    ).toEqual({ data: null, code: "23505" });
    expect((await rowsOf(A.id, QV)).length).toBe(1);
  });

  it("SC-7: group_attempts rows carry no confidence", async () => {
    const db = sql();
    try {
      const [g] = await db<{ id: string }[]>`
        insert into public.groups (name, pack_slug, invite_code, created_by)
        values (${`mf0065 ${RUN}`}, ${PACK}, ${`mf65${RUN}`.slice(0, 32)}, ${A.id})
        returning id::text as id`;
      if (!g) throw new Error("no group");
      groupId = g.id;
      for (const u of [A, B, C, D]) {
        await db`
          insert into public.group_members (group_id, user_id, role)
          values (${groupId}, ${u.id}, ${u === A ? "admin" : "member"})
          on conflict do nothing`;
      }
    } finally {
      await db.end();
    }
    for (const u of [B, C, D]) {
      await rec(u, {
        question: QG,
        chosen: ["B"],
        hash: "hg",
        id: randomUUID(),
        confidence: "unsure",
      });
    }
    const db2 = sql();
    try {
      const rows = await db2<{ attempts: Record<string, unknown>[] }[]>`
        select attempts from private.group_attempts(${groupId}::uuid, ${A.id}::uuid)`;
      const keys = new Set(
        rows.flatMap((r) => r.attempts.flatMap(Object.keys)),
      );
      expect(keys.size).toBeGreaterThan(0);
      expect(keys.has("confidence")).toBe(false);
    } finally {
      await db2.end();
    }
  });
});
