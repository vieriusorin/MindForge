/**
 * MF-0058 acceptance (SC-2): a course is complete exactly when every skill's stage is sapling, tree
 * or ancient. A wilting Sapling counts (C-1, user 2026-11-06). Rows and literals from the edge-input
 * table in .planning/tasks/MF-0058/GOAL.md; the 3.0-day boundary goes through the real `treeStage`
 * (FOREST_THRESHOLDS.saplingStabilityDays = 3, `>=`).
 */
import { describe, expect, it } from "vitest";
import type { ForestView } from "@/engine/forest";
import {
  type MemorySnapshot,
  type TreeStage,
  treeStage,
} from "@/engine/forest";
import { isCourseComplete } from "@/engine/path";

type Tree = TreeStage | { stage: TreeStage; wilting: boolean };

/** A one-region course forest; a bare stage is a tree that isn't wilting. */
function forest(trees: readonly Tree[]): ForestView {
  return {
    packSlug: "demo-course",
    packName: "Demo course",
    regions: [
      {
        domainCode: "D1",
        name: "Domain",
        weight: 100,
        trees: trees.map((t, i) => ({
          skillCode: `D1.S${i + 1}`,
          name: `Skill ${i + 1}`,
          weight: 100 / trees.length,
          ...(typeof t === "string" ? { stage: t, wilting: false } : t),
        })),
      },
    ],
  };
}

function memory(stabilityDays: number): MemorySnapshot {
  return {
    successfulRecalls: 1,
    stabilityDays,
    retrievability: 0.95,
    feynmanPassed: false,
    stormProven: false,
    fullStormProven: false,
  };
}

describe("MF-0058 SC-2: isCourseComplete", () => {
  it("SC-2: no attempts in the pack (every skill a seed) is not complete", () => {
    expect(isCourseComplete(forest(["seed", "seed", "seed"]))).toBe(false);
  });

  it("SC-2: one skill planted (sprout), the rest seeds, is not complete", () => {
    expect(isCourseComplete(forest(["sprout", "seed", "seed"]))).toBe(false);
  });

  it("SC-2: every skill sapling except one sprout is not complete", () => {
    expect(
      isCourseComplete(forest(["sapling", "sapling", "sprout", "sapling"])),
    ).toBe(false);
  });

  it("SC-2: one skill at exactly 3.0 days stability, the rest sapling, is complete", () => {
    expect(
      isCourseComplete(forest([treeStage(memory(3)), "sapling", "sapling"])),
    ).toBe(true);
  });

  it("SC-2: one skill at 2.99 days stability (a sprout), the rest sapling, is not complete", () => {
    expect(
      isCourseComplete(forest([treeStage(memory(2.99)), "sapling", "sapling"])),
    ).toBe(false);
  });

  it("SC-2: every skill sapling, some wilting, is complete (C-1)", () => {
    expect(
      isCourseComplete(
        forest([
          { stage: "sapling", wilting: true },
          "sapling",
          { stage: "sapling", wilting: true },
        ]),
      ),
    ).toBe(true);
  });

  it("SC-2: sapling, tree and ancient all count", () => {
    expect(isCourseComplete(forest(["sapling", "tree", "ancient"]))).toBe(true);
  });

  it("SC-2: a single seed among trees is not complete", () => {
    expect(isCourseComplete(forest(["tree", "ancient", "seed"]))).toBe(false);
  });

  it("SC-2: every skill across every region counts", () => {
    const twoRegions: ForestView = {
      ...forest(["sapling", "sapling"]),
      regions: [
        ...forest(["sapling", "sapling"]).regions,
        {
          domainCode: "D2",
          name: "Domain 2",
          weight: 1,
          trees: [
            {
              skillCode: "D2.S1",
              name: "Late skill",
              weight: 1,
              stage: "sprout",
              wilting: false,
            },
          ],
        },
      ],
    };
    expect(isCourseComplete(twoRegions)).toBe(false);
  });
});
