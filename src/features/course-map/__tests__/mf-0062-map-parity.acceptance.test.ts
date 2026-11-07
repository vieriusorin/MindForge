/**
 * MF-0062 acceptance (SC-5): the course map and the path page show the same figures for a course.
 * One owner per figure: total and fading are `summarizeForest`'s (what the path page's course row
 * shows), done-for-all is `isCourseComplete`, and Water first is Today's top focus. Both pages read
 * the forest with `getMyCourseForest` (checked in the source of each page).
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  type ForestView,
  summarizeForest,
  type TreeStage,
} from "@/engine/forest";
import { courseMap, isCourseComplete } from "@/engine/path";

const APP = join(process.cwd(), "src", "app", "(app)");

type Spec = readonly [
  code: string,
  stage: TreeStage,
  wilting: boolean,
  weight: number,
];

function forest(regions: readonly (readonly Spec[])[]): ForestView {
  return {
    packSlug: "demo",
    packName: "Demo",
    regions: regions.map((trees, i) => ({
      domainCode: `D${i + 1}`,
      name: `Domain ${i + 1}`,
      weight: 50,
      trees: trees.map(([skillCode, stage, wilting, weight]) => ({
        skillCode,
        name: skillCode,
        weight,
        stage,
        wilting,
      })),
    })),
  };
}

const CASES: Record<string, ForestView> = {
  fresh: forest([
    [
      ["a", "seed", false, 10],
      ["b", "seed", false, 20],
    ],
  ]),
  mixed: forest([
    [
      ["a", "sprout", true, 10],
      ["b", "sapling", false, 30],
    ],
    [
      ["c", "seed", false, 25],
      ["d", "tree", true, 35],
    ],
  ]),
  complete: forest([
    [["a", "sapling", true, 10]],
    [["b", "ancient", false, 90]],
  ]),
  "complete healthy": forest([
    [
      ["a", "tree", false, 50],
      ["b", "sapling", false, 50],
    ],
  ]),
};

describe("MF-0062 SC-5: the course map agrees with the path page and Today", () => {
  for (const [name, f] of Object.entries(CASES)) {
    it(`SC-5 (${name}): total and fading equal summarizeForest; done-for-all equals isCourseComplete`, () => {
      const map = courseMap({
        forest: f,
        plantable: new Set(),
        hasExam: false,
      });
      const summary = summarizeForest(f);
      expect(map.totalSkills).toBe(summary.totalSkills);
      expect(map.wiltingSkills).toBe(summary.wiltingSkills);
      expect(map.doneCount === map.totalSkills).toBe(isCourseComplete(f));
    });
  }

  it("SC-5: Water first names Today's top focus skill", () => {
    const f = CASES.mixed as ForestView;
    const map = courseMap({ forest: f, plantable: new Set(), hasExam: false });
    expect(map.next).toEqual({ kind: "water", skillCode: "d" });
    expect(summarizeForest(f).focus[0]?.skillCode).toBe("d");
  });

  it("SC-5: the map page and the path page both read getMyCourseForest", () => {
    for (const page of [
      join(APP, "play", "[packSlug]", "page.tsx"),
      join(APP, "paths", "[pathSlug]", "page.tsx"),
    ]) {
      const text = readFileSync(page, "utf8");
      expect(text).toMatch(
        /import\s*\{[^}]*\bgetMyCourseForest\b[^}]*\}\s*from\s*["']@\/server\/paths\/get-my-course-forest["']/,
      );
      expect(text).toMatch(/\bgetMyCourseForest\s*\(/);
    }
  });
});
