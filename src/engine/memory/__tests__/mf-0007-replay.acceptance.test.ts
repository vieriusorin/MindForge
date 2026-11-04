import { describe, expect, it } from "vitest";
import { reviewContextFromRows } from "../../content/review";
import { countableAttempts } from "../countable";
import type { Attempt } from "../types";

const at = (iso: string): Date => new Date(iso);
const attempt = (
  questionId: string,
  answeredAt: string,
  correct = true,
): Attempt => ({
  questionId,
  skillCode: "S1",
  correct,
  answeredAt: at(answeredAt),
});

describe("MF-0007 replay filter", () => {
  it("SC-8: rejected questions and attempts after reviewing are excluded; flagged still count", () => {
    const ctx = reviewContextFromRows([
      { itemId: "p.S1.rejected", state: "rejected", reviewedAt: null },
      { itemId: "p.S1.flagged", state: "flagged", reviewedAt: null },
      {
        itemId: "p.S1.spoiled",
        state: "unreviewed",
        reviewedAt: "2026-11-02T12:00:00.000Z",
      },
      { itemId: "p.S1.plain", state: "approved", reviewedAt: null },
    ]);

    expect([...ctx.rejected]).toEqual(["p.S1.rejected"]);
    expect([...ctx.spoiledBy]).toEqual(["p.S1.spoiled"]);
    expect(ctx.spoiledAt.get("p.S1.spoiled")?.toISOString()).toBe(
      "2026-11-02T12:00:00.000Z",
    );
    expect(ctx.states.get("p.S1.flagged")).toBe("flagged");

    const attempts = [
      attempt("p.S1.rejected", "2026-11-01T09:00:00.000Z"),
      attempt("p.S1.flagged", "2026-11-01T09:00:00.000Z"),
      attempt("p.S1.spoiled", "2026-11-02T11:59:59.000Z"), // before reviewing: counts
      attempt("p.S1.spoiled", "2026-11-02T12:00:00.000Z"), // at the review: does not
      attempt("p.S1.spoiled", "2026-11-03T08:00:00.000Z"), // after: does not
      attempt("p.S1.plain", "2026-11-03T08:00:00.000Z", false),
      attempt("p.S1.unknown", "2026-11-03T08:00:00.000Z"), // not in the context: counts
    ];

    const kept = countableAttempts(attempts, ctx).map(
      (a) => `${a.questionId}@${a.answeredAt.toISOString()}`,
    );
    expect(kept).toEqual([
      "p.S1.flagged@2026-11-01T09:00:00.000Z",
      "p.S1.spoiled@2026-11-02T11:59:59.000Z",
      "p.S1.plain@2026-11-03T08:00:00.000Z",
      "p.S1.unknown@2026-11-03T08:00:00.000Z",
    ]);
  });
});
