/**
 * MF-0003 acceptance: answers are graded by the database against private.question_keys.
 * Runs against the LOCAL Supabase stack (pnpm test:db). `it` blocks share state in order.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadPackFile } from "@/engine/pack/load-pack";
import { loadPackQuestions } from "@/engine/questions/load-questions";
import {
  anonClient,
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const ROOT = process.cwd();
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const Q = "ccdv-f.D2.S3.official-1"; // Exam Guide Sample 1, key = [B]
let A: TestUser;
let B: TestUser;

const sync = (): string =>
  execFileSync("node", [join(ROOT, "scripts/sync-question-keys.mjs")], {
    cwd: ROOT,
    encoding: "utf8",
  });

beforeAll(async () => {
  A = await createTestUser(`mf0003-a-${RUN}@test.local`);
  B = await createTestUser(`mf0003-b-${RUN}@test.local`);
});

afterAll(async () => {
  for (const u of [A, B]) if (u) await deleteTestUser(u.id); // attempts cascade with the user
});

describe("MF-0003 graded attempts", () => {
  it("SC-5: sync copies every key, is idempotent, and keys are unreadable by clients", async () => {
    sync();
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const questions = await loadPackQuestions(
      pack,
      join(ROOT, "packs/ccdv-f/questions"),
    );
    const db = sql();
    try {
      const rows =
        await db`select question_id, correct_options from private.question_keys where pack_slug = 'ccdv-f'`;
      const inDb = new Map(
        rows.map((r) => [
          r.question_id as string,
          [...(r.correct_options as string[])].sort(),
        ]),
      );
      expect(inDb.size).toBe(questions.length);
      for (const q of questions) {
        expect([q.id, inDb.get(q.id)]).toEqual([
          q.id,
          q.options
            .filter((o) => o.correct)
            .map((o) => o.id)
            .sort(),
        ]);
      }
      sync();
      const [{ n }] =
        await db`select count(*)::int as n from private.question_keys where pack_slug = 'ccdv-f'`;
      expect(n).toBe(questions.length);
      const [priv] = await db`
        select has_table_privilege('authenticated', 'private.question_keys', 'select') as auth,
               has_table_privilege('anon', 'private.question_keys', 'select') as anon`;
      expect(priv).toEqual({ auth: false, anon: false });
    } finally {
      await db.end();
    }
  });

  it("SC-4a: record_attempt grades exactly against the key", async () => {
    expect(
      (
        await A.client.rpc("record_attempt", {
          p_question_id: Q,
          p_chosen: ["B"],
        })
      ).data,
    ).toBe(true);
    expect(
      (
        await A.client.rpc("record_attempt", {
          p_question_id: Q,
          p_chosen: ["A"],
        })
      ).data,
    ).toBe(false);
    expect(
      (
        await A.client.rpc("record_attempt", {
          p_question_id: Q,
          p_chosen: ["B", "C"],
        })
      ).data,
    ).toBe(false);
    const rows = await A.client
      .from("attempts")
      .select("question_id, skill_code, pack_slug, correct")
      .order("answered_at");
    expect(rows.data).toEqual([
      {
        question_id: Q,
        skill_code: "D2.S3",
        pack_slug: "ccdv-f",
        correct: true,
      },
      {
        question_id: Q,
        skill_code: "D2.S3",
        pack_slug: "ccdv-f",
        correct: false,
      },
      {
        question_id: Q,
        skill_code: "D2.S3",
        pack_slug: "ccdv-f",
        correct: false,
      },
    ]);
  });

  it("SC-4b: clients cannot forge or alter grades, and see only their own attempts", async () => {
    const forged = await A.client.from("attempts").insert({
      user_id: A.id,
      pack_slug: "ccdv-f",
      skill_code: "D2.S3",
      question_id: Q,
      chosen: ["A"],
      correct: true,
    });
    expect(forged.error).not.toBeNull();
    await A.client
      .from("attempts")
      .update({ correct: true })
      .eq("user_id", A.id);
    const after = await A.client
      .from("attempts")
      .select("correct")
      .order("answered_at");
    expect(after.data?.map((r) => r.correct)).toEqual([true, false, false]);

    expect(
      (await B.client.from("attempts").select("id").eq("user_id", A.id)).data,
    ).toEqual([]);
    expect(
      (
        await A.client.rpc("record_attempt", {
          p_question_id: "ccdv-f.nope.q9",
          p_chosen: ["A"],
        })
      ).error,
    ).not.toBeNull();

    const anon = anonClient();
    expect(
      (await anon.rpc("record_attempt", { p_question_id: Q, p_chosen: ["B"] }))
        .error,
    ).not.toBeNull();
    expect((await anon.from("attempts").select("id")).data ?? []).toEqual([]);
  });
});
