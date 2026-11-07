import { describe, expect, it } from "vitest";
import type { ForestView } from "@/engine/forest";
import { courseMap, nextStep } from "@/engine/path";

const f: ForestView = {
  packSlug: "p",
  packName: "P",
  regions: [
    {
      domainCode: "A",
      name: "A",
      weight: 100,
      trees: [
        {
          skillCode: "a.1",
          name: "a1",
          weight: 60,
          stage: "seed",
          wilting: false,
        },
        {
          skillCode: "a.2",
          name: "a2",
          weight: 40,
          stage: "seed",
          wilting: false,
        },
      ],
    },
  ],
};

describe("courseMap", () => {
  it("reads plantability per skill code, not per position", () => {
    const map = courseMap({
      forest: f,
      plantable: new Set(["a.2"]),
      hasExam: false,
    });
    expect(map.domains[0]?.nodes.map((n) => n.mode)).toEqual(["walk", "plant"]);
  });

  it("puts next on the same skill nextStep picks, whatever is plantable", () => {
    const map = courseMap({
      forest: f,
      plantable: new Set(["a.2"]),
      hasExam: true,
    });
    expect(map.next).toEqual(nextStep(f));
    expect(map.next).toEqual({ kind: "next", skillCode: "a.1" });
  });
});

describe("nextStep", () => {
  it("takes a Seed in map order even when a later Seed weighs more", () => {
    const heavyLater: ForestView = {
      ...f,
      regions: [
        {
          domainCode: "A",
          name: "A",
          weight: 100,
          trees: [
            {
              skillCode: "z",
              name: "z",
              weight: 1,
              stage: "seed",
              wilting: false,
            },
            {
              skillCode: "b",
              name: "b",
              weight: 99,
              stage: "seed",
              wilting: false,
            },
          ],
        },
      ],
    };
    expect(nextStep(heavyLater)).toEqual({ kind: "next", skillCode: "z" });
  });
});
