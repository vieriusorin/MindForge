import { describe, expect, it } from "vitest";
import type { ForestView } from "../../forest/build-forest";
import { isCourseComplete } from "../is-course-complete";

const EMPTY: ForestView = { packSlug: "p", packName: "P", regions: [] };

describe("isCourseComplete", () => {
  it("is false for a forest with no trees (nothing to complete)", () => {
    expect(isCourseComplete(EMPTY)).toBe(false);
  });

  it("is false when the only region has no trees", () => {
    expect(
      isCourseComplete({
        ...EMPTY,
        regions: [{ domainCode: "D1", name: "D", weight: 100, trees: [] }],
      }),
    ).toBe(false);
  });

  it("is true when every tree is grown", () => {
    expect(
      isCourseComplete({
        ...EMPTY,
        regions: [
          {
            domainCode: "D1",
            name: "D",
            weight: 100,
            trees: [
              {
                skillCode: "a",
                name: "A",
                weight: 50,
                stage: "sapling",
                wilting: true,
              },
              {
                skillCode: "b",
                name: "B",
                weight: 50,
                stage: "ancient",
                wilting: false,
              },
            ],
          },
        ],
      }),
    ).toBe(true);
  });
});
