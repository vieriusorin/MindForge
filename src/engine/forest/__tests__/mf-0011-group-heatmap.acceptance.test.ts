/**
 * MF-0011 acceptance (engine half): the group heatmap is an aggregate of each member's engine
 * replay, shown only when 3 members OTHER than the viewer have played (C-3), and it carries
 * nothing per member and no count. Expected values are worked by hand from the definitions in
 * GOAL.md ("Decided without a question"). Re-frozen 2026-11-04 (C-3, user approved). Re-frozen
 * 2026-11-05 by MF-0021 (user approved): the healthy share is a band (few < ⅓ ≤ some < ⅔ ≤ most) and
 * the recall is a word only, so the region keys and values below changed; the fixtures did not.
 * Re-frozen again 2026-11-05 by MF-0021 SC-7 (user approved): the figures pool the OTHER members only,
 * so the viewer's own play can't move the card between two loads; the viewer's C.1 tree drops out.
 */
import { describe, expect, it } from "vitest";
import { emptyReviewContext } from "../../content/review";
import type { ReviewContext } from "../../content/types";
import { countableAttempts, memoryBySkill } from "../../memory";
import type { Attempt } from "../../memory/types";
import { parsePack } from "../../pack/load-pack";
import {
  groupHeatmapFromAttempts,
  MIN_OTHER_CONTRIBUTORS,
  summarizeGroupHeatmap,
} from "../group-heatmap";
import type { MemorySnapshot } from "../tree-stage";

const pack = parsePack(`
slug: p
name: P
kind: course
version: 1
domains:
  - code: A
    name: Alpha
    weight: 50
    skills:
      - { code: A.1, name: One, weight: 25 }
      - { code: A.2, name: Two, weight: 25 }
  - code: B
    name: Beta
    weight: 30
    skills:
      - { code: B.1, name: Three, weight: 30 }
  - code: C
    name: Gamma
    weight: 20
    skills:
      - { code: C.1, name: Four, weight: 20 }
`);

const snap = (
  successfulRecalls: number,
  stabilityDays: number,
  retrievability: number,
): MemorySnapshot => ({
  successfulRecalls,
  stabilityDays,
  retrievability,
  feynmanPassed: false,
  stormProven: false,
  fullStormProven: false,
});

// m1: A.1 sapling (stab 4) holding → healthy; A.2 seed (0 recalls) with memory R 0.6 → not healthy.
const m1 = new Map([
  ["A.1", snap(2, 4, 0.9)],
  ["A.2", snap(0, 0.5, 0.6)],
]);
// m2: A.1 sprout, R 0.7 < 0.85 → wilting → not healthy.
const m2 = new Map([["A.1", snap(1, 1, 0.7)]]);
// m3: A.1 sprout R 1.0 → healthy; B.1 sapling R 0.95 → healthy.
const m3 = new Map([
  ["A.1", snap(1, 2, 1)],
  ["B.1", snap(2, 5, 0.95)],
]);
// the viewer: C.1 sprout R 0.9 → healthy.
const v = new Map([["C.1", snap(1, 2, 0.9)]]);
const nobody = new Map<string, MemorySnapshot>();

describe("MF-0011 group heatmap (engine)", () => {
  it("SC-2: with 2 OTHER contributing members the heatmap is 'not enough data', even when the viewer plays too", () => {
    expect(MIN_OTHER_CONTRIBUTORS).toBe(3);
    expect(
      summarizeGroupHeatmap({ pack, viewer: v, others: [m1, m2] }),
    ).toEqual({ status: "not-enough-data" });
    // a member without memory doesn't count
    expect(
      summarizeGroupHeatmap({ pack, viewer: v, others: [m1, nobody, m2] }),
    ).toEqual({ status: "not-enough-data" });
  });

  it("SC-2: with 3 other contributing members it returns per-region figures and nothing per member, no count", () => {
    const heatmap = summarizeGroupHeatmap({
      pack,
      viewer: nobody,
      others: [m1, m2, nobody, m3],
    });
    expect(heatmap.status).toBe("ready");
    expect(Object.keys(heatmap).sort()).toEqual(["regions", "status"]);
    if (heatmap.status !== "ready") return;
    for (const region of heatmap.regions) {
      expect(Object.keys(region).sort()).toEqual([
        "domainCode",
        "healthyBand",
        "name",
        "status",
      ]);
    }
  });

  it("SC-4: region figures follow the definition (pairs over other contributors × skills), the viewer left out", () => {
    expect(
      summarizeGroupHeatmap({ pack, viewer: v, others: [m1, m2, m3] }),
    ).toEqual({
      status: "ready",
      regions: [
        // A: 3 others × 2 = 6 pairs, healthy m1·A.1 + m3·A.1 = 2 → 2/6 = ⅓ → some; R (0.9+0.6+0.7+1)/4 = 0.80 → fading
        {
          domainCode: "A",
          name: "Alpha",
          healthyBand: "some",
          status: "fading",
        },
        // B: 3 pairs, healthy m3·B.1 = 1 → 1/3 → some; R 0.95 → holding
        {
          domainCode: "B",
          name: "Beta",
          healthyBand: "some",
          status: "holding",
        },
        // C: 3 pairs, only the viewer has C.1 and is left out → 0 → few; no other has memory → no-data
        {
          domainCode: "C",
          name: "Gamma",
          healthyBand: "few",
          status: "no-data",
        },
      ],
    });
  });

  const T = new Date("2026-11-04T10:00:00Z");
  const attempt = (
    questionId: string,
    skillCode: string,
    correct: boolean,
  ): Attempt => ({ questionId, skillCode, correct, answeredAt: T });
  const fresh = (a: Attempt) => ({
    attempts: [a],
    review: emptyReviewContext(),
  });
  const spoiledBefore = (questionId: string): ReviewContext => {
    const context = emptyReviewContext();
    context.spoiledBy.add(questionId);
    context.spoiledAt.set(questionId, new Date("2026-11-03T10:00:00Z"));
    return context;
  };
  const rejected = (questionId: string): ReviewContext => {
    const context = emptyReviewContext();
    context.rejected.add(questionId);
    return context;
  };

  it("SC-4: spoiled and rejected attempts don't make a member contribute (MF-0007 filters, per member)", () => {
    const heatmap = groupHeatmapFromAttempts({
      pack,
      now: T,
      viewer: fresh(attempt("q1", "A.1", true)),
      others: [
        fresh(attempt("q1", "A.1", true)),
        fresh(attempt("q1", "A.1", true)),
        // reviewed q1 the day before answering it: spoiled for THIS member only
        { attempts: [attempt("q1", "A.1", true)], review: spoiledBefore("q1") },
        { attempts: [attempt("q2", "A.1", true)], review: rejected("q2") },
      ],
    });
    expect(heatmap).toEqual({ status: "not-enough-data" });
  });

  it("SC-4: figures equal the mean of each member's engine replay (calculation parity)", () => {
    const others = [
      fresh(attempt("q1", "A.1", true)),
      fresh(attempt("q1", "A.1", true)),
      // a wrong answer: memory exists (R 1.0 at the moment of answering), but the tree is a seed
      fresh(attempt("q1", "A.1", false)),
    ];
    const heatmap = groupHeatmapFromAttempts({
      pack,
      now: T,
      viewer: null,
      others,
    });
    // A: 3 × 2 = 6 pairs, 2 healthy sprouts → 2/6 = ⅓ → some; all three answered just now → R 100 % → holding
    expect(heatmap).toEqual({
      status: "ready",
      regions: [
        {
          domainCode: "A",
          name: "Alpha",
          healthyBand: "some",
          status: "holding",
        },
        {
          domainCode: "B",
          name: "Beta",
          healthyBand: "few",
          status: "no-data",
        },
        {
          domainCode: "C",
          name: "Gamma",
          healthyBand: "few",
          status: "no-data",
        },
      ],
    });
    // parity: the same figures as replaying each member through the engine by hand
    expect(heatmap).toEqual(
      summarizeGroupHeatmap({
        pack,
        viewer: new Map(),
        others: others.map((m) =>
          memoryBySkill(countableAttempts(m.attempts, m.review), T),
        ),
      }),
    );
  });
});
