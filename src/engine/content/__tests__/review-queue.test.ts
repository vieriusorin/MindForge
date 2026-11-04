import { describe, expect, it } from "vitest";
import type { Pack } from "../../pack/types";
import { nextReviewItem, orderReviewQueue } from "../review-queue";
import type { PackContent, ReviewCandidate } from "../types";

const pack: Pack = {
  slug: "p",
  name: "P",
  kind: "course",
  version: 1,
  domains: [
    {
      code: "D1",
      name: "One",
      weight: 50,
      skills: [
        { code: "S-light", name: "Light", weight: 10 },
        { code: "S-heavy", name: "Heavy", weight: 30 },
        { code: "S-tie", name: "Tie", weight: 10 },
      ],
    },
  ],
};

const c = (
  itemId: string,
  skillCode: string,
  itemType: ReviewCandidate["itemType"] = "question",
): ReviewCandidate => ({
  itemId,
  skillCode,
  itemType,
  contentHash: `h-${itemId}`,
});

describe("orderReviewQueue", () => {
  it("puts heavy skills first, then pack order on equal weight", () => {
    const order = orderReviewQueue(
      [c("t1", "S-tie"), c("l1", "S-light"), c("h1", "S-heavy")],
      pack,
    ).map((x) => x.itemId);
    expect(order).toEqual(["h1", "l1", "t1"]);
  });

  it("keeps items of one skill in id order, and skills unknown to the pack last", () => {
    const order = orderReviewQueue(
      [c("x1", "S-gone"), c("h2", "S-heavy"), c("h1", "S-heavy", "card")],
      pack,
    ).map((x) => x.itemId);
    expect(order).toEqual(["h1", "h2", "x1"]);
  });

  it("returns an empty queue for no candidates", () => {
    expect(orderReviewQueue([], pack)).toEqual([]);
  });
});

const question = (id: string, skillCode: string) => ({
  id,
  skillCode,
  origin: "ai" as const,
  stem: id,
  select: 1,
  options: [{ id: "A", text: "a", correct: true, rationale: "r" }],
  source: { title: "Doc", url: "https://example.com" },
});

describe("nextReviewItem", () => {
  const content: PackContent = {
    questions: [
      question("l1", "S-light"),
      question("t1", "S-tie"),
      question("h1", "S-heavy"),
    ],
    cards: [],
    diagrams: [],
  };
  const deployed = { l1: "h-l1", t1: "h-t1", h1: "h-h1" };

  it("returns the heaviest queued item with the version it shows, skipping ids the files no longer hold", () => {
    const next = nextReviewItem(
      [c("t1", "S-tie"), c("h-gone", "S-heavy"), c("l1", "S-light")],
      pack,
      content,
      deployed,
    );
    expect(next?.packItem.item.id).toBe("l1");
    expect(next?.contentHash).toBe("h-l1");
  });

  it("skips an item whose deployed file is another version than the registry's", () => {
    const next = nextReviewItem(
      [c("h1", "S-heavy"), c("l1", "S-light")],
      pack,
      content,
      { ...deployed, h1: "h-h1-older-deploy" },
    );
    expect(next?.packItem.item.id).toBe("l1");
  });

  it("returns null when nothing is left", () => {
    expect(
      nextReviewItem([c("h-gone", "S-heavy")], pack, content, deployed),
    ).toBeNull();
  });
});
