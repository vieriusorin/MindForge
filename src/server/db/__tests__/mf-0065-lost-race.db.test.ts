/**
 * MF-0065 review note 3: the lost-race path of `record_attempt` compares the confidence tap too. A second call with
 * the same client attempt id but another tap, sent while the first call is uncommitted, waits for the first commit
 * and is then refused (23505); one row stays, with the first tap. LOCAL stack only (`pnpm test:db`).
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
const PACK = "mf0065-race";
const QR = `${PACK}.S1.${RUN}.race`;
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
  A = await createTestUser(`mf0065-race-${RUN}@test.local`);
  const db = sql();
  try {
    await db`insert into private.question_keys (question_id, pack_slug, skill_code, correct_options)
             values (${QR}, ${PACK}, 'S1', ${["B"]})`;
    await db`insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
             values (${QR}, ${PACK}, 'S1', 'question', 'qr', 'official')`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  if (A) await deleteTestUser(A.id);
});

describe("MF-0065 record_attempt: the lost race compares the tap", () => {
  it("a concurrent same-id call with another tap waits for the commit, then gets 23505", async () => {
    const id = randomUUID();
    const db = sql();
    let isReleased = false;
    let first: boolean | null = null;
    let second:
      | PromiseLike<{
          data: unknown;
          code: string | null;
          isReleasedAtResponse: boolean;
        }>
      | undefined;
    try {
      await db.begin(async (tx) => {
        await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: A.id, role: "authenticated" })}, true)`;
        await tx`set local role authenticated`;
        const [row] = await tx<{ correct: boolean }[]>`
          select public.record_attempt(${QR}::text, ${["B"]}::text[], 'qr'::text, ${id}::uuid, 'sure'::text) as correct`;
        first = row?.correct ?? null;
        // `.then` sends the request now, while the first insert is uncommitted.
        second = A.client
          .rpc("record_attempt", {
            p_question_id: QR,
            p_chosen: ["B"],
            p_content_hash: "qr",
            p_client_attempt_id: id,
            p_confidence: "unsure",
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
      data: null,
      code: "23505",
      isReleasedAtResponse: true,
    });
    const check = sql();
    try {
      const rows = await check<{ confidence: string | null }[]>`
        select confidence from public.attempts where user_id = ${A.id} and question_id = ${QR}`;
      expect(rows).toEqual([{ confidence: "sure" }]);
    } finally {
      await check.end();
    }
  });
});
