import { describe, expect, it } from "vitest";
import { reviewContextFromRows } from "@/engine/content";
import { buildStormCandidates } from "../build-storm-candidates";

const questions = [
  { id: "official-1", skillCode: "1.1", origin: "official" as const },
  { id: "human-1", skillCode: "1.1", origin: "human" as const },
  { id: "flagged-1", skillCode: "1.2", origin: "human" as const },
  { id: "spoiled-1", skillCode: "1.2", origin: "human" as const },
  { id: "unsynced-1", skillCode: "1.2", origin: "official" as const },
];
const hashes: Record<string, string> = {
  "official-1": "h1",
  "human-1": "h2",
  "flagged-1": "h3",
  "spoiled-1": "h4",
};
const review = reviewContextFromRows([
  { itemId: "flagged-1", state: "flagged", reviewedAt: null },
  {
    itemId: "spoiled-1",
    state: "approved",
    reviewedAt: "2026-11-01T00:00:00Z",
  },
]);

describe("buildStormCandidates", () => {
  const candidates = buildStormCandidates({
    questions,
    review,
    hashes,
    seen: new Set(["human-1"]),
  });
  const byId = new Map(candidates.map((c) => [c.id, c]));

  it("drops a question with no deployed content hash", () => {
    expect(byId.has("unsynced-1")).toBe(false);
    expect(candidates).toHaveLength(4);
  });

  it("maps each question's review state (official starts approved, human unreviewed)", () => {
    expect(byId.get("official-1")?.state).toBe("approved");
    expect(byId.get("human-1")?.state).toBe("unreviewed");
    expect(byId.get("flagged-1")?.state).toBe("flagged");
  });

  it("marks questions the learner reviewed as spoiled", () => {
    expect(byId.get("spoiled-1")?.spoiled).toBe(true);
    expect(byId.get("official-1")?.spoiled).toBe(false);
  });

  it("marks questions from an earlier storm as seen", () => {
    expect(byId.get("human-1")?.seenInStorm).toBe(true);
    expect(byId.get("official-1")?.seenInStorm).toBe(false);
  });

  it("keeps the skill code", () => {
    expect(byId.get("flagged-1")?.skillCode).toBe("1.2");
  });
});
