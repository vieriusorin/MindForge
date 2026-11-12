// MF-0066 SC-4: gradeOrder sends the learner's sequence to record_attempt only when the engine allows it,
// and reveals the key only after the database graded it.
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Diagram, OrderItem, ReviewContext } from "@/engine/content";

const { rpc, recordCourseCompletion, states } = vi.hoisted(() => ({
  rpc: vi.fn(),
  recordCourseCompletion: vi.fn(async (_input: unknown): Promise<void> => {}),
  states: new Map<string, "approved" | "flagged">(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
}));
vi.mock("@/server/paths/record-course-completion", () => ({
  recordCourseCompletion,
}));
vi.mock("@/server/content/get-pack-content", () => ({
  getPackContent: async () => ({ diagrams: [DIAGRAM] }),
}));
vi.mock("@/server/content/get-pack-orders", () => ({
  getPackOrders: async () => [ORDER],
}));
vi.mock("@/server/content/get-item-hashes", () => ({
  getItemHashes: async () => ({ "p.S1.order-1": "h1" }),
}));
vi.mock("@/server/content/get-review-context", () => ({
  getReviewContext: async (): Promise<ReviewContext> => ({
    states,
    rejected: new Set(),
    spoiledBy: new Set(),
    spoiledAt: new Map(),
  }),
}));

const DIAGRAM: Diagram = {
  id: "p.S1.diagram-1",
  skill: "S1",
  title: "Loop",
  origin: "ai",
  direction: "LR",
  nodes: [
    { id: "A", label: "a" },
    { id: "B", label: "b" },
    { id: "C", label: "c" },
  ],
  edges: [
    { from: "A", to: "B" },
    { from: "B", to: "C" },
  ],
  sources: ["https://example.com"],
};

const ORDER: OrderItem = {
  id: "p.S1.order-1",
  skill: "S1",
  title: "Order it",
  origin: "ai",
  diagram: "p.S1.diagram-1",
  steps: [
    { node: "A", label: "a" },
    { node: "B", label: "b" },
    { node: "C", label: "c" },
  ],
  orderedBy: ["a, then b, then c"],
  explanation: "Because.",
  source: { title: "Doc", url: "https://example.com" },
};

const INPUT = {
  userId: "u1",
  packSlug: "p",
  orderId: "p.S1.order-1",
  order: ["B", "A", "C"],
  contentHash: "h1",
  clientAttemptId: "5e1d7a3c-2b4f-4e6a-9d8c-7f0e1a2b3c4d",
};

const { gradeOrder } = await import("../grade-order");

describe("gradeOrder (MF-0066 SC-4)", () => {
  beforeEach(() => {
    rpc.mockReset();
    recordCourseCompletion.mockReset();
    recordCourseCompletion.mockResolvedValue(undefined);
    states.clear();
    states.set("p.S1.diagram-1", "approved");
  });

  it("sends the learner's sequence, hash and attempt id; reveals the key order after grading", async () => {
    rpc.mockResolvedValue({ data: false, error: null });
    const result = await gradeOrder(INPUT);
    expect(rpc).toHaveBeenCalledWith("record_attempt", {
      p_question_id: "p.S1.order-1",
      p_chosen: ["B", "A", "C"],
      p_content_hash: "h1",
      p_client_attempt_id: INPUT.clientAttemptId,
    });
    expect(result).toEqual({
      ok: true,
      feedback: {
        correct: false,
        steps: ORDER.steps,
        explanation: "Because.",
      },
    });
    expect(recordCourseCompletion).not.toHaveBeenCalled();
  });

  it("a correct order records a course completion check", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const result = await gradeOrder({ ...INPUT, order: ["A", "B", "C"] });
    expect(result.ok && result.feedback.correct).toBe(true);
    expect(recordCourseCompletion).toHaveBeenCalledTimes(1);
  });

  it("refuses without calling the database when the diagram is not approved", async () => {
    states.set("p.S1.diagram-1", "flagged");
    expect(await gradeOrder(INPUT)).toEqual({ ok: false, error: "withdrawn" });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("refuses a changed version and a non-permutation without calling the database", async () => {
    expect(await gradeOrder({ ...INPUT, contentHash: "old" })).toEqual({
      ok: false,
      error: "changed",
    });
    expect(await gradeOrder({ ...INPUT, order: ["A", "B"] })).toEqual({
      ok: false,
      error: "invalid-order",
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it("maps a stale registry version to changed and any other RPC error to not-gradable", async () => {
    rpc.mockResolvedValueOnce({ data: null, error: { code: "55000" } });
    expect(await gradeOrder(INPUT)).toEqual({ ok: false, error: "changed" });
    rpc.mockResolvedValueOnce({ data: null, error: { code: "P0002" } });
    expect(await gradeOrder(INPUT)).toEqual({
      ok: false,
      error: "not-gradable",
    });
  });
});
