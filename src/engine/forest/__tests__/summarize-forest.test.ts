import { describe, expect, it } from "vitest";
import type { ForestView } from "../build-forest";
import { STAGE_ORDER, summarizeForest } from "../summarize-forest";

const forest: ForestView = {
  packSlug: "p",
  packName: "P",
  regions: [
    {
      domainCode: "D1",
      name: "One",
      weight: 30,
      trees: [
        {
          skillCode: "D1.S1",
          name: "a",
          weight: 10,
          stage: "sapling",
          wilting: false,
        },
        {
          skillCode: "D1.S2",
          name: "b",
          weight: 20,
          stage: "seed",
          wilting: false,
        },
      ],
    },
    {
      domainCode: "D2",
      name: "Two",
      weight: 70,
      trees: [
        {
          skillCode: "D2.S1",
          name: "c",
          weight: 40,
          stage: "seed",
          wilting: false,
        },
        {
          skillCode: "D2.S2",
          name: "d",
          weight: 5,
          stage: "sprout",
          wilting: true,
        },
        {
          skillCode: "D2.S3",
          name: "e",
          weight: 25,
          stage: "seed",
          wilting: false,
        },
      ],
    },
  ],
};

describe("summarizeForest", () => {
  it("counts stages and weights from the trees", () => {
    const s = summarizeForest(forest);
    expect(s.totalSkills).toBe(5);
    expect(s.grownSkills).toBe(2);
    expect(s.wiltingSkills).toBe(1);
    expect(s.totalWeight).toBe(100);
    expect(s.grownWeight).toBe(15);
    expect(s.grownPercent).toBe(15);
    expect(s.stageCounts).toEqual({
      seed: 3,
      sprout: 1,
      sapling: 1,
      tree: 0,
      ancient: 0,
    });
  });

  it("reports per-domain grown weight against the blueprint weight", () => {
    const [d1, d2] = summarizeForest(forest).domains;
    expect(d1).toMatchObject({
      domainCode: "D1",
      weight: 30,
      grownWeight: 10,
      skillCount: 2,
      grownSkillCount: 1,
    });
    expect(d2).toMatchObject({
      domainCode: "D2",
      weight: 70,
      grownWeight: 5,
      skillCount: 3,
      grownSkillCount: 1,
    });
  });

  it("focuses wilting trees first, then seeds by weight, and skips healthy growth", () => {
    const codes = summarizeForest(forest).focus.map((f) => f.skillCode);
    expect(codes).toEqual(["D2.S2", "D2.S1", "D2.S3", "D1.S2"]);
  });

  it("caps the focus list", () => {
    expect(summarizeForest(forest, 2).focus).toHaveLength(2);
  });

  it("an all-seed forest has nothing grown", () => {
    const seeds: ForestView = {
      ...forest,
      regions: forest.regions.map((r) => ({
        ...r,
        trees: r.trees.map((t) => ({
          ...t,
          stage: "seed" as const,
          wilting: false,
        })),
      })),
    };
    const s = summarizeForest(seeds);
    expect(s.grownWeight).toBe(0);
    expect(s.grownPercent).toBe(0);
    expect(s.grownSkills).toBe(0);
    expect(s.domains.every((d) => d.grownWeight === 0)).toBe(true);
  });

  it("lists stages in growth order", () => {
    expect(STAGE_ORDER).toEqual([
      "seed",
      "sprout",
      "sapling",
      "tree",
      "ancient",
    ]);
  });
});
