/**
 * MF-0067 review note 2: a reused client attempt id with a NULL question (or hash mismatch through NULLs) must be
 * refused with 23505 like any other different answer, never answered with the stored grade. Direct RPC calls only;
 * the app always sends a question id. Runs against the LOCAL stack (`pnpm test:db`).
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
const PACK = "mf0067-review";
const Q = `${PACK}.S1.${RUN}.q`;
let A: TestUser;

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
  A = await createTestUser(`mf0067-review-${RUN}@test.local`);
  const db = sql();
  try {
    await db`
      insert into private.question_keys (question_id, pack_slug, skill_code, correct_options)
      values (${Q}, ${PACK}, 'S1', ${["B"]})`;
    await db`
      insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
      values (${Q}, ${PACK}, 'S1', 'question', 'h', 'official')`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  if (A) await deleteTestUser(A.id);
});

describe("MF-0067 review: a reused id with a NULL question is refused", () => {
  it("returns 23505, not the stored grade, and writes nothing", async () => {
    const id = randomUUID();
    const first = await A.client.rpc("record_attempt", {
      p_question_id: Q,
      p_chosen: ["B"],
      p_content_hash: "h",
      p_client_attempt_id: id,
    });
    expect([first.error, first.data]).toEqual([null, true]);

    const reused = await A.client.rpc("record_attempt", {
      p_question_id: null,
      p_chosen: ["B"],
      p_content_hash: null,
      p_client_attempt_id: id,
    });
    expect([reused.error?.code ?? null, reused.data]).toEqual(["23505", null]);

    const db = sql();
    try {
      const rows = await db`
        select 1 from public.attempts where user_id = ${A.id} and pack_slug = ${PACK}`;
      expect(rows).toHaveLength(1);
    } finally {
      await db.end();
    }
  });
});
