// MF-0066 (user decision U-b): dev:seed approves the diagrams the shipped order items are drawn from, so the
// demo lessons show order steps, without touching what the seed does not own (MF-0068 re-run rules).
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorlds } from "../plan-demo-world";
import {
  planOrderDiagramApprovals,
  withOrderApprovals,
} from "../plan-order-approvals";
import { planSeed } from "../plan-seed";
import type { DemoWorld, PlannedReview, SeedItem } from "../types";

const NOW = new Date("2026-11-07T10:00:00Z");
const DIAGRAM: SeedItem = {
  itemId: "p.S1.diagram-loop",
  itemType: "diagram",
  skillCode: "S1",
  origin: "ai",
  authorEmail: "author@example.com",
  contentHash: "h-diagram",
};

function world(reviews: PlannedReview[] = [], authorIsDemo = false): DemoWorld {
  const learners = [
    { email: "new@demo.test", displayName: "N", persona: "new" as const },
    {
      email: authorIsDemo ? "author@example.com" : "crammer@demo.test",
      displayName: "C",
      persona: "crammer" as const,
    },
    { email: "lapsed@demo.test", displayName: "L", persona: "lapsed" as const },
    { email: "you@example.com", displayName: "", persona: "you" as const },
  ];
  return {
    learners,
    group: { name: "Demo", packSlug: "p", createdByEmail: "new@demo.test" },
    attempts: [],
    reviews,
    joins: [],
    storms: [],
    expedition: null,
  };
}

const review = (
  reviewerEmail: string,
  verdict: "approve" | "flag",
): PlannedReview => ({
  reviewerEmail,
  itemId: DIAGRAM.itemId,
  contentHash: DIAGRAM.contentHash,
  verdict,
  comment: verdict === "flag" ? "wrong" : null,
  createdAt: NOW,
});

const plan = (
  w: DemoWorld,
  over: { exclude?: string[]; item?: SeedItem } = {},
) =>
  planOrderDiagramApprovals({
    now: NOW,
    worlds: [w],
    packs: [
      {
        packSlug: "p",
        items: [over.item ?? DIAGRAM],
        orderDiagramIds: [DIAGRAM.itemId],
      },
    ],
    excludeItemIds: over.exclude ?? [],
  });

describe("planOrderDiagramApprovals", () => {
  it("two approvals from two demo reviewers, at the item's current hash, a day back", () => {
    const { approvals, skipped } = plan(world());
    expect(skipped).toEqual([]);
    expect(
      approvals.map((a) => [
        a.packSlug,
        a.review.reviewerEmail,
        a.review.verdict,
        a.review.contentHash,
      ]),
    ).toEqual([
      ["p", "new@demo.test", "approve", "h-diagram"],
      ["p", "crammer@demo.test", "approve", "h-diagram"],
    ]);
    expect(approvals[0]?.review.createdAt).toEqual(
      new Date("2026-11-06T10:00:00Z"),
    );
  });

  it("never the author, never you, never a reviewer the world already planned on the item; existing approvals count", () => {
    const authorDemo = plan(world([], true));
    expect(authorDemo.approvals.map((a) => a.review.reviewerEmail)).toEqual([
      "new@demo.test",
      "lapsed@demo.test",
    ]);
    const one = plan(world([review("new@demo.test", "approve")]));
    expect(one.approvals.map((a) => a.review.reviewerEmail)).toEqual([
      "crammer@demo.test",
    ]);
    const two = plan(
      world([
        review("new@demo.test", "approve"),
        review("lapsed@demo.test", "approve"),
      ]),
    );
    expect(two.approvals).toEqual([]);
    expect(two.skipped).toEqual([]);
  });

  it("leaves what it does not own: your reviews / resolutions / real flags (excluded), a world flag, an official item", () => {
    expect(plan(world(), { exclude: [DIAGRAM.itemId] })).toMatchObject({
      approvals: [],
      skipped: [{ itemId: DIAGRAM.itemId }],
    });
    expect(plan(world([review("lapsed@demo.test", "flag")]))).toMatchObject({
      approvals: [],
      skipped: [{ itemId: DIAGRAM.itemId, reason: "the demo world flags it" }],
    });
    expect(
      plan(world(), { item: { ...DIAGRAM, origin: "official" } }),
    ).toMatchObject({
      approvals: [],
      skipped: [{ reason: "official: already approved" }],
    });
  });

  it("withOrderApprovals appends to the matching world only and does not change its input", () => {
    const w = world();
    const before = structuredClone(w);
    const { approvals } = plan(w);
    const [seeded] = withOrderApprovals([w], approvals);
    expect(seeded?.reviews).toHaveLength(2);
    expect(w).toEqual(before);
    expect(
      withOrderApprovals(
        [{ ...w, group: { ...w.group, packSlug: "q" } }],
        approvals,
      )[0]?.reviews,
    ).toEqual([]);
  });

  it("real prod-prompting inputs at seed 42: every order diagram gets two approvals; the worlds are unchanged", async () => {
    const inputs = await loadSeedInputs(
      join(process.cwd(), "packs", "prod-prompting"),
    );
    expect(inputs.orderDiagramIds.length).toBeGreaterThan(0);
    const packs = [{ ...inputs, groupName: "Demo prod-prompting" }];
    const args = {
      now: NOW,
      seed: 42,
      youEmail: "you@example.com",
      demoDomain: "mindforge-demo.test",
    };
    const seeded = planSeed({ ...args, packs, paths: [] });
    expect(seeded.worlds).toEqual(planDemoWorlds({ ...args, packs }));
    expect(seeded.orderApprovals.skipped).toEqual([]);
    for (const id of inputs.orderDiagramIds) {
      const approvers = seeded.orderApprovals.approvals.filter(
        (a) => a.review.itemId === id,
      );
      const planned =
        seeded.worlds[0]?.reviews.filter(
          (r) => r.itemId === id && r.verdict === "approve",
        ) ?? [];
      expect(approvers.length + planned.length, id).toBe(2);
      expect(
        approvers.every((a) => !a.review.reviewerEmail.startsWith("you@")),
        id,
      ).toBe(true);
    }
  });
});
