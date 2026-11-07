/**
 * MF-0032 acceptance (SC-5): every question mode tells the learner when the item changed since the
 * page loaded. Mocked at the facades the actions depend on (auth, the shared grading path).
 * Expected strings are literals from GOAL.md SC-5.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gradeAnswer } = vi.hoisted(() => ({ gradeAnswer: vi.fn() }));

vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "u1" }),
}));
vi.mock("@/server/attempts/grade-answer", () => ({ gradeAnswer }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const INPUT = {
  packSlug: "p",
  questionId: "p.S1.q1",
  chosen: ["B"],
  contentHash: "h1",
  clientAttemptId: "0b6c2f6e-1d2a-4c3b-8e4f-5a6b7c8d9e0f", // MF-0067: required by the input schema
};

describe("MF-0032 SC-5: a changed question is worded per mode", () => {
  beforeEach(() => {
    gradeAnswer.mockReset();
    gradeAnswer.mockResolvedValue({ ok: false, error: "changed" });
  });

  it("SC-5: Duel", async () => {
    const { answerQuestion } = await import("@/features/duel/actions");
    expect(await answerQuestion(INPUT)).toEqual({
      ok: false,
      error: "This question changed since you opened it. Start a new duel.",
    });
  });

  it("SC-5: Walk", async () => {
    const { answerWalkQuestion } = await import("@/features/walk/actions");
    expect(await answerWalkQuestion(INPUT)).toEqual({
      ok: false,
      error:
        "This question changed since you opened it. Go back to Today to start a fresh walk.",
    });
  });

  it("SC-5: Seed Planting", async () => {
    const { answerSeedCheck } = await import(
      "@/features/seed-planting/actions"
    );
    expect(await answerSeedCheck(INPUT)).toEqual({
      ok: false,
      error:
        "This question changed since you opened it. Reload the page for a fresh set of checks.",
    });
  });

  it("SC-4: the hash the learner sent reaches the grading path", async () => {
    gradeAnswer.mockResolvedValue({
      ok: true,
      feedback: { correct: true, correctOptionIds: ["B"], rationales: {} },
    });
    const { answerQuestion } = await import("@/features/duel/actions");
    await answerQuestion(INPUT);
    expect(gradeAnswer).toHaveBeenCalledWith({ userId: "u1", ...INPUT });
  });
});
