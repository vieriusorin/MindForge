import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Cuckoo, ReviewContext } from "@/engine/content";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("@/server/supabase/server", () => ({
  createServerSupabase: async () => ({ rpc }),
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
};

const { gradeCuckoo } = await import("../grade-cuckoo");

describe("gradeCuckoo (MF-0032)", () => {
  beforeEach(() => rpc.mockReset());

  it("sends the hash the learner read to record_attempt", async () => {
    rpc.mockResolvedValue({ data: true, error: null });
    const result = await gradeCuckoo(INPUT);
    expect(rpc).toHaveBeenCalledWith("record_attempt", {
      p_question_id: "p.S1.c1",
      p_chosen: ["2"],
      p_content_hash: "h1",
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
