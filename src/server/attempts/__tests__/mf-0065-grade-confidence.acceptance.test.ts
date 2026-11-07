/**
 * MF-0065 acceptance (SC-10, grading path) — frozen. `gradeAnswer` sends the learner's tap to
 * `record_attempt` as `p_confidence`, and no `p_confidence` key when there was none, so the DB default (null)
 * applies (GOAL DQ-1, DQ-6; the generated Args type has no null for a defaulted parameter). Mocked at the
 * Supabase facade and the content reads, as the inner grade-answer test is.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReviewContext } from "@/engine/content";
import type { Question } from "@/engine/questions";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock("@/server/paths/record-course-completion", () => ({
  recordCourseCompletion: async (): Promise<void> => {},
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
  clientAttemptId: "5e1d7a3c-2b4f-4e6a-9d8c-7f0e1a2b3c4d",
};

const ARGS = {
  p_question_id: "p.S1.q1",
  p_chosen: ["B"],
  p_content_hash: "h1",
  p_client_attempt_id: "5e1d7a3c-2b4f-4e6a-9d8c-7f0e1a2b3c4d",
};

const { gradeAnswer } = await import("../grade-answer");

describe("MF-0065 SC-10: gradeAnswer sends the confidence to record_attempt", () => {
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockResolvedValue({ data: true, error: null });
  });

  it("SC-10: a tap is sent as p_confidence", async () => {
    await gradeAnswer({ ...INPUT, confidence: "unsure" });
    expect(rpc).toHaveBeenCalledWith("record_attempt", {
      ...ARGS,
      p_confidence: "unsure",
    });
  });

  it("SC-10: no tap sends no p_confidence (the DB default, null)", async () => {
    await gradeAnswer(INPUT);
    expect(rpc).toHaveBeenCalledWith("record_attempt", ARGS);
  });
});
