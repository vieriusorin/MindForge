import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import { buildForest } from "../build-forest";

const pack = parsePack(`
slug: p
name: P
kind: course
version: 1
domains:
  - code: A
    name: Alpha
    weight: 100
    skills:
      - { code: A.1, name: One, weight: 70 }
      - { code: A.2, name: Two, weight: 30 }
`);

describe("buildForest", () => {
  it("renders every skill as a seed when nothing is remembered yet", () => {
    const forest = buildForest(pack);
    expect(forest.regions).toHaveLength(1);
    expect(
      forest.regions[0]?.trees.map((t) => [t.skillCode, t.stage, t.wilting]),
    ).toEqual([
      ["A.1", "seed", false],
      ["A.2", "seed", false],
    ]);
  });

  it("uses measured memory for known skills only", () => {
    const memory = new Map([
      [
        "A.2",
        {
          successfulRecalls: 2,
          stabilityDays: 4,
          retrievability: 0.8,
          feynmanPassed: false,
          stormProven: false,
          fullStormProven: false,
        },
      ],
    ]);
    const trees = buildForest(pack, memory).regions[0]?.trees ?? [];
    expect(trees.map((t) => [t.skillCode, t.stage, t.wilting])).toEqual([
      ["A.1", "seed", false],
      ["A.2", "sapling", true],
    ]);
  });
});
