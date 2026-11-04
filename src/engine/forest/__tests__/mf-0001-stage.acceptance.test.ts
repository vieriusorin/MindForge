import { describe, expect, it } from "vitest";
import { type MemorySnapshot, treeStage } from "../tree-stage";

// Re-frozen 2026-11-04 by MF-0013 (approved 2026-11-03): Tree = stability ≥ 14 d and
// (Feynman passed or storm-proven); Ancient = stability ≥ 45 d and Full-Storm-proven (CONTEXT.md).
const m = (over: Partial<MemorySnapshot>): MemorySnapshot => ({
  successfulRecalls: 1,
  stabilityDays: 1,
  retrievability: 0.95,
  feynmanPassed: false,
  stormProven: false,
  fullStormProven: false,
  ...over,
});

describe("MF-0001 tree stage (spec §2.2)", () => {
  it("SC-5a: stage follows measured memory only", () => {
    expect(treeStage(null)).toEqual({ stage: "seed", wilting: false });
    expect(treeStage(m({ successfulRecalls: 0, stabilityDays: 0 })).stage).toBe(
      "seed",
    );
    expect(treeStage(m({ stabilityDays: 1 })).stage).toBe("sprout");
    expect(treeStage(m({ stabilityDays: 3 })).stage).toBe("sapling");
    expect(treeStage(m({ stabilityDays: 14 })).stage).toBe("sapling");
    expect(treeStage(m({ stabilityDays: 14, feynmanPassed: true })).stage).toBe(
      "tree",
    );
    expect(treeStage(m({ stabilityDays: 45, feynmanPassed: true })).stage).toBe(
      "tree",
    );
  });

  it("SC-5b: wilting below retrievability 0.85, never on a seed", () => {
    expect(treeStage(m({ stabilityDays: 3, retrievability: 0.84 }))).toEqual({
      stage: "sapling",
      wilting: true,
    });
    expect(treeStage(m({ stabilityDays: 3, retrievability: 0.85 }))).toEqual({
      stage: "sapling",
      wilting: false,
    });
    expect(
      treeStage(
        m({ successfulRecalls: 0, stabilityDays: 0, retrievability: 0.1 }),
      ),
    ).toEqual({
      stage: "seed",
      wilting: false,
    });
  });
});

describe("MF-0013 tree stage with storms", () => {
  it("SC-6: storm-proven grows a Tree; Full-Storm-proven grows an Ancient tree", () => {
    expect(treeStage(m({ stabilityDays: 20, stormProven: true })).stage).toBe(
      "tree",
    );
    expect(treeStage(m({ stabilityDays: 20 })).stage).toBe("sapling");
    expect(
      treeStage(
        m({ stabilityDays: 50, stormProven: true, fullStormProven: true }),
      ).stage,
    ).toBe("ancient");
    expect(treeStage(m({ stabilityDays: 50, stormProven: true })).stage).toBe(
      "tree",
    );
    expect(
      treeStage(
        m({ stabilityDays: 13, stormProven: true, fullStormProven: true }),
      ).stage,
    ).toBe("sapling");
  });
});
