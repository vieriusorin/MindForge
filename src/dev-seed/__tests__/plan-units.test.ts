import { describe, expect, it } from "vitest";
import { planReviews } from "../plan-demo-world";
import { createRandom } from "../random";
import type { PlannedAttempt, PlannedLearner, SeedItem } from "../types";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const AUTHOR = "author@example.com";
const learners: PlannedLearner[] = (
  ["steady", "crammer", "lapsed", "new", "strong"] as const
).map((persona) => ({
  email: `${persona}@d.test`,
  displayName: persona,
  persona,
}));

const item = (itemId: string, over: Partial<SeedItem> = {}): SeedItem => ({
  itemId,
  itemType: "question",
  skillCode: "D1.S1",
  origin: "ai",
  authorEmail: AUTHOR,
  contentHash: `h-${itemId}`,
  ...over,
});

const answeredBy = (email: string, questionId: string): PlannedAttempt => ({
  email,
  questionId,
  skillCode: "D1.S1",
  packSlug: "p",
  chosen: ["A"],
  correct: true,
  answeredAt: new Date(NOW.getTime() - 1000),
});

describe("planReviews (review_item's rules, applied by the planner)", () => {
  const items = [
    item("q1"),
    item("q2"),
    item("q3"),
    item("q4"),
    item("c1", { itemType: "card" }),
    item("off", { origin: "official", authorEmail: null }),
    item("mine", { authorEmail: "steady@d.test" }),
  ];

  it("plans 2 approvals on one question, 1 flag with a comment, 2 single approvals, at the current hash", () => {
    const reviews = planReviews({
      now: NOW,
      random: createRandom(1),
      learners,
      attempts: [],
      items,
    });
    expect(reviews.filter((r) => r.verdict === "flag")).toHaveLength(1);
    expect(reviews.find((r) => r.verdict === "flag")?.comment).toBeTruthy();
    const approvals = reviews.filter((r) => r.verdict === "approve");
    expect(approvals).toHaveLength(4);
    const perItem = new Map<string, number>();
    for (const r of approvals)
      perItem.set(r.itemId, (perItem.get(r.itemId) ?? 0) + 1);
    expect([...perItem.values()].sort()).toEqual([1, 1, 2]);
    for (const r of reviews) {
      expect(r.contentHash).toBe(`h-${r.itemId}`);
      expect(r.itemId).not.toBe("off");
      expect(r.createdAt.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it("flags an AI-written item, never a human one", () => {
    const reviews = planReviews({
      now: NOW,
      random: createRandom(5),
      learners,
      attempts: [],
      // The only non-question item is human: the old rule (cards and diagrams first) flagged it.
      items: [
        ...items.filter((i) => i.itemType === "question"),
        item("human-card", { itemType: "card", origin: "human" }),
      ],
    });
    const flagged = reviews.find((r) => r.verdict === "flag");
    expect(flagged?.itemId).not.toBe("human-card");
    expect(items.find((i) => i.itemId === flagged?.itemId)?.origin).toBe("ai");
  });

  it("never lets a learner review their own item or a question they answered", () => {
    const attempts = ["q1", "q2", "q3"].flatMap((q) => [
      answeredBy("new@d.test", q),
      answeredBy("crammer@d.test", q),
    ]);
    const reviews = planReviews({
      now: NOW,
      random: createRandom(3),
      learners,
      attempts,
      items,
    });
    for (const r of reviews) {
      expect(
        !(r.reviewerEmail === "steady@d.test" && r.itemId === "mine"),
      ).toBe(true);
      expect(
        attempts.some(
          (t) => t.email === r.reviewerEmail && t.questionId === r.itemId,
        ),
      ).toBe(false);
    }
  });

  it("keeps every review off items a maintainer already resolved", () => {
    const reviews = planReviews({
      now: NOW,
      random: createRandom(1),
      learners,
      attempts: [],
      items,
      excludeItemIds: ["q1", "c1"],
    });
    for (const r of reviews) expect(["q1", "c1"]).not.toContain(r.itemId);
  });

  it("throws when no question can take two approvals", () => {
    expect(() =>
      planReviews({
        now: NOW,
        random: createRandom(1),
        learners,
        attempts: [],
        items: [item("off", { origin: "official", authorEmail: null })],
      }),
    ).toThrow(/approve/);
  });
});
