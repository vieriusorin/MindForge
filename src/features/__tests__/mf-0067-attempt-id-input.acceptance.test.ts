/**
 * MF-0067 acceptance (SC-8): every grading action requires a client attempt id (a uuid) and forwards it to
 * the shared grading path. Mocked at the facades the actions depend on (auth, the grading paths).
 * Expected strings are the existing parse-failure messages (GOAL.md SC-8).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

const { gradeAnswer, gradeCuckoo } = vi.hoisted(() => ({
  gradeAnswer: vi.fn(),
  gradeCuckoo: vi.fn(),
}));

vi.mock("@/server/auth/current-user", () => ({
  getCurrentUser: async () => ({ id: "u1" }),
}));
vi.mock("@/server/attempts/grade-answer", () => ({ gradeAnswer }));
vi.mock("@/server/attempts/grade-cuckoo", () => ({ gradeCuckoo }));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));

const ID = "3f2b8c1e-5d4a-4f6b-9c7d-2e1a0b9c8d7e";

const ANSWER = {
  packSlug: "p",
  questionId: "p.S1.q1",
  chosen: ["B"],
  contentHash: "h1",
};
const CUCKOO = {
  packSlug: "p",
  cuckooId: "p.S1.c1",
  line: 2,
  contentHash: "h1",
};

const answerModes = [
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
] as const;

describe("MF-0067 SC-8: the grading actions require and forward the client attempt id", () => {
  beforeEach(() => {
    gradeAnswer.mockReset();
    gradeAnswer.mockResolvedValue({
      ok: true,
      feedback: { correct: true, correctOptionIds: ["B"], rationales: {} },
    });
    gradeCuckoo.mockReset();
    gradeCuckoo.mockResolvedValue({
      ok: true,
      feedback: {
        correct: true,
        flawLine: 2,
        flawKind: "injected-instruction",
        explanation: "x",
      },
    });
  });

  for (const { mode, load } of answerModes) {
    it(`SC-8: ${mode} refuses an answer without an id`, async () => {
      const action = await load();
      expect(await action(ANSWER)).toEqual({
        ok: false,
        error: "Pick an answer first.",
      });
      expect(
        await action({ ...ANSWER, clientAttemptId: "not-a-uuid" }),
      ).toEqual({ ok: false, error: "Pick an answer first." });
      expect(gradeAnswer).not.toHaveBeenCalled();
    });

    it(`SC-8: ${mode} forwards the id to the grading path`, async () => {
      const action = await load();
      const result = await action({ ...ANSWER, clientAttemptId: ID });
      expect(result.ok).toBe(true);
      expect(gradeAnswer).toHaveBeenCalledWith({
        userId: "u1",
        ...ANSWER,
        clientAttemptId: ID,
      });
    });
  }

  it("SC-8: Spot the Cuckoo refuses an answer without an id", async () => {
    const { answerCuckoo } = await import("@/features/cuckoo/actions");
    expect(await answerCuckoo(CUCKOO)).toEqual({
      ok: false,
      error: "Pick a line first.",
    });
    expect(
      await answerCuckoo({ ...CUCKOO, clientAttemptId: "not-a-uuid" }),
    ).toEqual({ ok: false, error: "Pick a line first." });
    expect(gradeCuckoo).not.toHaveBeenCalled();
  });

  it("SC-8: Spot the Cuckoo forwards the id to the grading path", async () => {
    const { answerCuckoo } = await import("@/features/cuckoo/actions");
    const result = await answerCuckoo({ ...CUCKOO, clientAttemptId: ID });
    expect(result.ok).toBe(true);
    expect(gradeCuckoo).toHaveBeenCalledWith({
      userId: "u1",
      ...CUCKOO,
      clientAttemptId: ID,
    });
  });
});
