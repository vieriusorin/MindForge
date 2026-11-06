import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewContext } from "@/engine/content";
import type { Question } from "@/engine/questions";

const { rpc, recordCourseCompletion } = vi.hoisted(() => ({
  rpc: vi.fn(),
  recordCourseCompletion: vi.fn(async (_input: unknown): Promise<void> => {}),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock("@/server/paths/record-course-completion", () => ({
  recordCourseCompletion,
}));
vi.mock("@/server/questions/get-pack-questions", () => ({
  getPackQuestions: async (): Promise<Question[]> => [QUESTION],
}));
vi.mock("@/server/content/get-item-hashes", () => ({
  getItemHashes: async () => ({ "p.S1.q1": "h1" }),
}));
vi.mock("@/server/content/get-review-context", () => ({
  getReviewContext: async (): Promise<ReviewContext> => ({
    states: new Map(),
    rejected: new Set(),
    spoiledBy: new Set(),
    spoiledAt: new Map(),
  }),
}));

const QUESTION: Question = {
  id: "p.S1.q1",
  skillCode: "S1",
  origin: "official",
  stem: "Stem",
  select: 1,
  options: [
    { id: "A", text: "First", correct: false, rationale: "No" },
    { id: "B", text: "Second", correct: true, rationale: "Yes" },
  ],
  source: { title: "Docs", url: "https://example.com" },
};

const INPUT = {
  userId: "u1",
  packSlug: "p",
  questionId: "p.S1.q1",
  chosen: ["B"],
  contentHash: "h1",
};

const { gradeAnswer } = await import("../grade-answer");

describe("gradeAnswer (MF-0032)", () => {
  beforeEach(() => {
    rpc.mockReset();
    recordCourseCompletion.mockReset();
    recordCourseCompletion.mockResolvedValue(undefined);
  });

  it("sends the hash the learner read to record_attempt and reveals the key on success", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const result = await gradeAnswer(INPUT);
    expect(rpc).toHaveBeenCalledWith("record_attempt", {
      p_question_id: "p.S1.q1",
      p_chosen: ["B"],
      p_content_hash: "h1",
    });
    expect(result).toEqual({
      ok: true,
      feedback: {
        correct: true,
        correctOptionIds: ["B"],
        rationales: { A: "No", B: "Yes" },
      },
    });
  });

  it("refuses a hash the deployed file doesn't hold as changed, without calling the DB", async () => {
    const result = await gradeAnswer({ ...INPUT, contentHash: "h-old" });
    expect(result).toEqual({ ok: false, error: "changed" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps the DB's 55000 (registry ahead of this deploy) to changed", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
    expect(await gradeAnswer(INPUT)).toEqual({ ok: false, error: "changed" });
  });

  it("maps any other DB error to not-gradable", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    expect(await gradeAnswer(INPUT)).toEqual({
      ok: false,
      error: "not-gradable",
    });
  });
});

describe("gradeAnswer records Course complete (MF-0058 SC-6)", () => {
  beforeEach(() => {
    rpc.mockReset();
    recordCourseCompletion.mockReset();
    recordCourseCompletion.mockResolvedValue(undefined);
  });

  it("asks the recorder after a correct, recorded answer", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await gradeAnswer(INPUT);
    expect(recordCourseCompletion).toHaveBeenCalledWith({
      userId: "u1",
      packSlug: "p",
      now: expect.any(Date),
    });
  });

  it("doesn't ask the recorder after a wrong answer", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await gradeAnswer({ ...INPUT, chosen: ["A"] });
    expect(recordCourseCompletion).not.toHaveBeenCalled();
  });

  it("doesn't ask the recorder when the answer isn't recorded", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
    await gradeAnswer(INPUT);
    rpc.mockResolvedValue({ data: null, error: { code: "P0002" } });
    await gradeAnswer(INPUT);
    expect(recordCourseCompletion).not.toHaveBeenCalled();
  });

  it("returns the same feedback when the recorder fails", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    recordCourseCompletion.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await gradeAnswer(INPUT)).toEqual({
      ok: true,
      feedback: {
        correct: true,
        correctOptionIds: ["B"],
        rationales: { A: "No", B: "Yes" },
      },
    });
  });
});
