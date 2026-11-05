/**
 * MF-0032 acceptance (SC-1, SC-2, SC-6, SC-7): record_attempt names the content hash the learner read
 * and refuses it when the registry holds another version. Runs against the LOCAL stack (pnpm test:db).
 * Seeds its own pack slug in private.question_keys + private.items; deletes child-first afterwards.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "mf0032-test";
const X = `${PACK}.S1.${RUN}.x`; // key [B], registry hash H1
const Y = `${PACK}.S1.${RUN}.y`; // key [A], NO registry row
const Z = `${PACK}.S1.${RUN}.z`; // key [A] → [B] in an open transaction (SC-2)
const H1 = "h1-mf0032";
let A: TestUser;
let B: TestUser;

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

async function attemptsOf(id: string) {
  const db = sql();
  try {
    return await db<{ correct: boolean; content_hash: string | null }[]>`
      select correct, content_hash from public.attempts
      where question_id = ${id} and user_id = ${A.id} order by id`;
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  await clean();
  A = await createTestUser(`mf0032-a-${RUN}@test.local`);
  B = await createTestUser(`mf0032-b-${RUN}@test.local`);
  const db = sql();
  try {
    await db`
      insert into private.question_keys (question_id, pack_slug, skill_code, correct_options) values
        (${X}, ${PACK}, 'S1', ${["B"]}),
        (${Y}, ${PACK}, 'S1', ${["A"]}),
        (${Z}, ${PACK}, 'S1', ${["A"]})`;
    await db`
      insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin) values
        (${X}, ${PACK}, 'S1', 'question', ${H1}, 'official'),
        (${Z}, ${PACK}, 'S1', 'question', 'z-old', 'official')`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  for (const u of [A, B]) if (u) await deleteTestUser(u.id);
});

describe("MF-0032 record_attempt binds to the content hash", () => {
  it("SC-1: the read version grades and is stored", async () => {
    const res = await A.client.rpc("record_attempt", {
      p_question_id: X,
      p_chosen: ["B"],
      p_content_hash: H1,
    });
    expect([res.error, res.data]).toEqual([null, true]);
    expect(await attemptsOf(X)).toEqual([{ correct: true, content_hash: H1 }]);
  });

  it("SC-1: another version is refused with 55000 and writes nothing", async () => {
    const res = await A.client.rpc("record_attempt", {
      p_question_id: X,
      p_chosen: ["B"],
      p_content_hash: "h-other",
    });
    expect(res.error?.code).toBe("55000");
    expect(await attemptsOf(X)).toHaveLength(1);
  });

  it("SC-1: a hash for an item with no registry row is refused with P0002", async () => {
    const res = await A.client.rpc("record_attempt", {
      p_question_id: Y,
      p_chosen: ["A"],
      p_content_hash: "anything",
    });
    expect(res.error?.code).toBe("P0002");
    expect(await attemptsOf(Y)).toEqual([]);
  });

  it("SC-1/SC-6: the 2-arg call still grades; the row stores the registry hash, or null without one", async () => {
    const x = await A.client.rpc("record_attempt", {
      p_question_id: X,
      p_chosen: ["A"],
    });
    expect([x.error, x.data]).toEqual([null, false]);
    expect((await attemptsOf(X)).at(-1)).toEqual({
      correct: false,
      content_hash: H1,
    });
    const y = await A.client.rpc("record_attempt", {
      p_question_id: Y,
      p_chosen: ["A"],
    });
    expect([y.error, y.data]).toEqual([null, true]);
    expect(await attemptsOf(Y)).toEqual([
      { correct: true, content_hash: null },
    ]);
  });

  it("SC-6: the learner reads their own hash; another learner sees no row", async () => {
    const own = await A.client
      .from("attempts")
      .select("question_id, content_hash")
      .eq("question_id", X)
      .order("id");
    expect(own.error).toBeNull();
    expect(own.data?.map((r) => r.content_hash)).toEqual([H1, H1]);
    const other = await B.client
      .from("attempts")
      .select("question_id, content_hash")
      .eq("question_id", X);
    expect([other.error, other.data]).toEqual([null, []]);
  });

  it("SC-2: an answer sent while a sync transaction is open is graded on the committed version", async () => {
    // A sync writes the new key [B] and the new hash in ONE transaction. While it is still open, a learner
    // on the old page answers [B] with the old hash: graded against the committed key [A] (false).
    // The RPC is started at once (a PostgrestBuilder only sends on `then`) and must answer BEFORE the
    // commit, so this really runs against the open transaction (MF-0032 review). That the key and the hash
    // come from one snapshot is proven by the diff review (migration: one statement), not by this case.
    const db = sql();
    let isCommitted = false;
    const responses: {
      data: unknown;
      error: { code: string } | null;
      isCommittedAtResponse: boolean;
    }[] = [];
    try {
      await db.begin(async (tx) => {
        await tx`update private.question_keys set correct_options = ${["B"]} where question_id = ${Z}`;
        await tx`update private.items set content_hash = 'z-new' where item_id = ${Z}`;
        await A.client
          .rpc("record_attempt", {
            p_question_id: Z,
            p_chosen: ["B"],
            p_content_hash: "z-old",
          })
          .then((r) => {
            responses.push({
              data: r.data,
              error: r.error,
              isCommittedAtResponse: isCommitted,
            });
          });
      });
      isCommitted = true;
    } finally {
      await db.end();
    }
    expect(responses).toEqual([
      { data: false, error: null, isCommittedAtResponse: false },
    ]);

    // After the commit the old version is refused and the new one grades against the new key.
    const stale = await A.client.rpc("record_attempt", {
      p_question_id: Z,
      p_chosen: ["B"],
      p_content_hash: "z-old",
    });
    expect(stale.error?.code).toBe("55000");
    const fresh = await A.client.rpc("record_attempt", {
      p_question_id: Z,
      p_chosen: ["B"],
      p_content_hash: "z-new",
    });
    expect([fresh.error, fresh.data]).toEqual([null, true]);
  });

  it("SC-7: only the 3-arg signature exists; authenticated may execute it, anon may not", async () => {
    const db = sql();
    try {
      const rows = await db<{ sig: string; auth: boolean; anon: boolean }[]>`
        select p.oid::regprocedure::text as sig,
               has_function_privilege('authenticated', p.oid, 'execute') as auth,
               has_function_privilege('anon', p.oid, 'execute') as anon
        from pg_proc p
        where p.proname = 'record_attempt'
        order by 1`;
      expect(rows).toEqual([
        {
          sig: "private.record_attempt(text,text[],text)",
          auth: true,
          anon: false,
        },
        {
          sig: "record_attempt(text,text[],text)",
          auth: true,
          anon: false,
        },
      ]);
    } finally {
      await db.end();
    }
    const anon = await anonClient().rpc("record_attempt", {
      p_question_id: X,
      p_chosen: ["B"],
      p_content_hash: H1,
    });
    expect(anon.error).not.toBeNull();
  });
});
