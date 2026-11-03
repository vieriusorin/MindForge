import { describe, expect, it } from "vitest";
import { donutData, STAGE_CHART_CONFIG } from "../utils";

describe("donutData", () => {
  it("lists every stage in growth order with its count and colour slot", () => {
    expect(
      donutData({ seed: 25, sprout: 0, sapling: 0, tree: 0, ancient: 0 }),
    ).toEqual([
      { stage: "seed", count: 25, fill: "var(--color-seed)" },
      { stage: "sprout", count: 0, fill: "var(--color-sprout)" },
      { stage: "sapling", count: 0, fill: "var(--color-sapling)" },
      { stage: "tree", count: 0, fill: "var(--color-tree)" },
      { stage: "ancient", count: 0, fill: "var(--color-ancient)" },
    ]);
  });
});

describe("STAGE_CHART_CONFIG", () => {
  it("maps seed → ancient onto chart-1 → chart-5 (light → dark)", () => {
    expect(STAGE_CHART_CONFIG.seed).toEqual({
      label: "Seed",
      color: "var(--chart-1)",
    });
    expect(STAGE_CHART_CONFIG.ancient).toEqual({
      label: "Ancient tree",
      color: "var(--chart-5)",
    });
  });
});
