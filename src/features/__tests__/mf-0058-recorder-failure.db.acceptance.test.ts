/**
 * MF-0058 acceptance (SC-6): the completion recorder failing doesn't fail the attempt. Scenario Duel's
 * `answerQuestion` runs for real through the shared `gradeAnswer` (duel, walk and seed-planting share
 * it, fact (d)) against the LOCAL stack (pnpm test:db), with the recorder stubbed to throw. The
 * action still returns `ok`, the attempt row exists, and the recorder was reached (so the throw was
 * really swallowed, not skipped).
 *
 * Facades: auth and the per-request Supabase client (the learner's signed-in client), the recorder,
 * and the two "use cache" file reads (questions, hashes), which return the fixture question.
 * `record_attempt`, the review context and the attempts table run for real. Seeds its own pack slug;
 * deletes child-first afterwards.
 */
import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import type { Question } from "@/engine/questions";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const { current, recordCourseCompletion } = vi.hoisted(() => ({
  current: { user: null as null | { id: string; client: unknown } },
  recordCourseCompletion: vi.fn(async (_input: unknown): Promise<void> => {
    throw new Error("course_completions is down");
  }),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(() => {
    throw new Error("redirect");
  }),
}));
vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () =>
    current.user ? { id: current.user.id, email: null } : null,
}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => current.user?.client,
}));
vi.mock("@/server/paths/record-course-completion", () => ({
  recordCourseCompletion,
}));
vi.mock("@/server/questions/get-pack-questions", () => ({
  getPackQuestions: async (): Promise<Question[]> => [QUESTION],
}));
vi.mock("@/server/content/get-item-hashes", () => ({
  getItemHashes: async () => ({ [Q]: HASH }),
}));

const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
const PACK = "mf0058-recorder";
const Q = `${PACK}.S1.q1`;
const HASH = "h-mf0058-recorder";

const QUESTION: Question = {
  id: Q,
  skillCode: "S1",
  origin: "official",
  stem: "Which one?",
  select: 1,
  options: [
    { id: "A", text: "First", correct: false, rationale: "No" },
    { id: "B", text: "Second", correct: true, rationale: "Yes" },
  ],
  source: { title: "Docs", url: "https://example.com" },
};

// after the fixture constants: the mocks above read them when the action loads
const { answerQuestion } = await import("@/features/duel/actions");

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
  A = await createTestUser(`mf0058-sc6-${RUN}@test.local`);
  current.user = A;
  const db = sql();
  try {
    await db`
      insert into private.question_keys (question_id, pack_slug, skill_code, correct_options)
      values (${Q}, ${PACK}, 'S1', ${["B"]})`;
    await db`
      insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
      values (${Q}, ${PACK}, 'S1', 'question', ${HASH}, 'official')`;
  } finally {
    await db.end();
  }
});

afterAll(async () => {
  await clean();
  if (A) await deleteTestUser(A.id);
});

describe("MF-0058 SC-6: a failing recorder never fails the attempt", () => {
  it("SC-6: the recorder throws, the action still returns ok and the attempt row exists", async () => {
    const result = await answerQuestion({
      packSlug: PACK,
      questionId: Q,
      chosen: ["B"],
      contentHash: HASH,
      clientAttemptId: randomUUID(), // MF-0067: required by the input schema
    });

    expect(result).toEqual({
      ok: true,
      feedback: {
        correct: true,
        correctOptionIds: ["B"],
        rationales: { A: "No", B: "Yes" },
      },
    });

    const db = sql();
    try {
      const rows = await db<{ question_id: string; correct: boolean }[]>`
        select question_id, correct from public.attempts
        where user_id = ${A.id} and pack_slug = ${PACK}`;
      expect(rows).toEqual([{ question_id: Q, correct: true }]);
    } finally {
      await db.end();
    }

    // the throw happened inside the grading path and was swallowed there
    expect(recordCourseCompletion).toHaveBeenCalledWith(
      expect.objectContaining({ userId: A.id, packSlug: PACK }),
    );
  });
});
