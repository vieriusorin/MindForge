/**
 * MF-0065 acceptance (SC-10, actions) — frozen. Every question-grading action accepts an optional
 * `confidence` of "sure" or "unsure", refuses any other value with the existing parse-failure message, and
 * forwards it to the shared grading path; an answer without a tap forwards none (GOAL DQ-6).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gradeAnswer } = vi.hoisted(() => ({ gradeAnswer: vi.fn() }));

vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "u1" }),
}));
vi.mock("@/server/attempts/grade-answer", () => ({ gradeAnswer }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const ANSWER = {
  packSlug: "p",
  questionId: "p.S1.q1",
  chosen: ["B"],
  contentHash: "h1",
  clientAttemptId: "3f2b8c1e-5d4a-4f6b-9c7d-2e1a0b9c8d7e",
};

const modes = [
  {
    mode: "Duel",
    load: async () => (await import("@/features/duel/actions")).answerQuestion,
  },
  {
    mode: "Walk",
    load: async () =>
      (await import("@/features/walk/actions")).answerWalkQuestion,
  },
  {
    mode: "Seed Planting",
    load: async () =>
      (await import("@/features/seed-planting/actions")).answerSeedCheck,
  },
  {
    mode: "Lesson",
    load: async () =>
      (await import("@/features/lesson/actions")).answerLessonItem,
  },
] as const;

describe("MF-0065 SC-10: the grading actions take an optional confidence", () => {
  beforeEach(() => {
    gradeAnswer.mockReset();
    gradeAnswer.mockResolvedValue({
      ok: true,
      feedback: { correct: true, correctOptionIds: ["B"], rationales: {} },
    });
  });

  for (const { mode, load } of modes) {
    it(`SC-10: ${mode} forwards sure and unsure`, async () => {
      const action = await load();
      for (const confidence of ["sure", "unsure"] as const) {
        gradeAnswer.mockClear();
        expect((await action({ ...ANSWER, confidence })).ok).toBe(true);
        expect(gradeAnswer).toHaveBeenCalledWith({
          userId: "u1",
          ...ANSWER,
          confidence,
        });
      }
    });

    it(`SC-10: ${mode} forwards no confidence when there was no tap`, async () => {
      const action = await load();
      expect((await action(ANSWER)).ok).toBe(true);
      expect(gradeAnswer).toHaveBeenCalledWith({ userId: "u1", ...ANSWER });
    });

    it(`SC-10: ${mode} refuses any other confidence`, async () => {
      const action = await load();
      for (const confidence of ["SURE", "maybe", "", null, 1]) {
        expect(await action({ ...ANSWER, confidence })).toEqual({
          ok: false,
          error: "Pick an answer first.",
        });
      }
      expect(gradeAnswer).not.toHaveBeenCalled();
    });
  }
});
