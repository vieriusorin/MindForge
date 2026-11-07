import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cuckoo, ReviewContext } from "@/engine/content";

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
vi.mock("@/server/content/get-pack-content", () => ({
  getPackContent: async () => ({ cuckoos: [CUCKOO] }),
}));
vi.mock("@/server/content/get-item-hashes", () => ({
  getItemHashes: async () => ({ "p.S1.c1": "h1" }),
}));
vi.mock("@/server/content/get-review-context", () => ({
  getReviewContext: async (): Promise<ReviewContext> => ({
    states: new Map(),
    rejected: new Set(),
    spoiledBy: new Set(),
    spoiledAt: new Map(),
  }),
}));

const CUCKOO: Cuckoo = {
  id: "p.S1.c1",
  skill: "S1",
  title: "A tool result",
  origin: "official",
  snippetKind: "tool-result",
  lines: ["one", "two", "three"],
  flawLine: 2,
  flawKind: "injected-instruction",
  explanation: "Line 2 is an instruction.",
  sources: ["https://example.com"],
};

const INPUT = {
  userId: "u1",
  packSlug: "p",
  cuckooId: "p.S1.c1",
  line: 2,
  contentHash: "h1",
  clientAttemptId: "5e1d7a3c-2b4f-4e6a-9d8c-7f0e1a2b3c4d",
};

const { gradeCuckoo } = await import("../grade-cuckoo");

describe("gradeCuckoo (MF-0032)", () => {
  beforeEach(() => {
    rpc.mockReset();
    recordCourseCompletion.mockReset();
    recordCourseCompletion.mockResolvedValue(undefined);
  });

  it("sends the hash the learner read to record_attempt", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const result = await gradeCuckoo(INPUT);
    expect(rpc).toHaveBeenCalledWith("record_attempt", {
      p_question_id: "p.S1.c1",
      p_chosen: ["2"],
      p_content_hash: "h1",
      p_client_attempt_id: "5e1d7a3c-2b4f-4e6a-9d8c-7f0e1a2b3c4d",
    });
    expect(result.ok).toBe(true);
  });

  it("maps the DB's 55000 (registry ahead of this deploy) to changed", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
    expect(await gradeCuckoo(INPUT)).toEqual({ ok: false, error: "changed" });
  });

  it("maps any other DB error to not-gradable", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    expect(await gradeCuckoo(INPUT)).toEqual({
      ok: false,
      error: "not-gradable",
    });
  });
});

describe("gradeCuckoo records Course complete (MF-0058 SC-6)", () => {
  beforeEach(() => {
    rpc.mockReset();
    recordCourseCompletion.mockReset();
    recordCourseCompletion.mockResolvedValue(undefined);
  });

  it("asks the recorder after a correct, recorded answer", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    await gradeCuckoo(INPUT);
    expect(recordCourseCompletion).toHaveBeenCalledWith({
      userId: "u1",
      packSlug: "p",
      now: expect.any(Date),
    });
  });

  it("doesn't ask the recorder after a wrong answer", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    await gradeCuckoo({ ...INPUT, line: 1 });
    expect(recordCourseCompletion).not.toHaveBeenCalled();
  });

  it("doesn't ask the recorder when the answer isn't recorded", async () => {
    rpc.mockResolvedValue({ data: null, error: { code: "55000" } });
    await gradeCuckoo(INPUT);
    rpc.mockResolvedValue({ data: null, error: { code: "42501" } });
    await gradeCuckoo(INPUT);
    expect(recordCourseCompletion).not.toHaveBeenCalled();
  });

  it("returns the same feedback when the recorder fails", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    recordCourseCompletion.mockRejectedValue(new Error("down"));
    vi.spyOn(console, "error").mockImplementation(() => {});
    expect(await gradeCuckoo(INPUT)).toEqual({
      ok: true,
      feedback: {
        correct: true,
        flawLine: 2,
        flawKind: "injected-instruction",
        explanation: "Line 2 is an instruction.",
      },
    });
  });
});

describe("gradeCuckoo (MF-0067)", () => {
  it("maps a reused attempt id (23505) to not-gradable and records no completion", async () => {
    rpc.mockReset();
    recordCourseCompletion.mockReset();
    rpc.mockResolvedValue({ data: null, error: { code: "23505" } });
    expect(await gradeCuckoo(INPUT)).toEqual({
      ok: false,
      error: "not-gradable",
    });
    expect(recordCourseCompletion).not.toHaveBeenCalled();
  });
});
