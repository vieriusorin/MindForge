import { describe, expect, it } from "vitest";
import type { ForestView } from "@/engine/forest";
import type { CourseProgress } from "@/engine/path";
import {
  buildCourseRows,
  COMPLETION_RULE,
  fadingLabel,
  SOURCE_LINK_LABEL,
  SOURCE_NOTE,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_STAGE,
  skillCountLabel,
  stageCountParts,
} from "../utils";

function forest(
  packSlug: string,
  trees: { stage: "seed" | "sprout" | "sapling"; wilting?: boolean }[],
): ForestView {
  return {
    packSlug,
    packName: `Pack ${packSlug}`,
    regions: [
      {
        domainCode: "D1",
        name: "Domain",
        weight: 100,
        trees: trees.map((t, i) => ({
          skillCode: `D1.S${i + 1}`,
          name: `Skill ${i + 1}`,
          weight: 100 / trees.length,
          stage: t.stage,
          wilting: t.wilting ?? false,
        })),
      },
    ],
  };
}

describe("status words", () => {
  it("names every status in words, with a badge and a stage tile", () => {
    expect(STATUS_LABEL).toEqual({
      complete: "Complete",
      "in-progress": "In progress",
      "not-started": "Not started",
    });
    expect(STATUS_BADGE.complete).toBe("default");
    expect(STATUS_STAGE).toEqual({
      complete: "sapling",
      "in-progress": "sprout",
      "not-started": "seed",
    });
  });

  it("states the completion rule in one sentence about Sapling", () => {
    expect(COMPLETION_RULE).toMatch(/every skill in it reaches Sapling/);
  });

  it("says the path is MindForge's, not a record of Anthropic's path (MF-0058 review)", () => {
    expect(SOURCE_NOTE).toMatch(/courses MindForge has a pack for/);
    expect(SOURCE_NOTE).toMatch(/not a record on Anthropic's side/);
    expect(SOURCE_NOTE).not.toMatch(/certif/i);
    expect(SOURCE_LINK_LABEL).toBe("See the Anthropic path");
  });
});

describe("fadingLabel", () => {
  it("says nothing when no skill is fading", () => {
    expect(fadingLabel(0)).toBeNull();
  });

  it("counts fading skills with the right plural", () => {
    expect(fadingLabel(1)).toBe("1 skill fading");
    expect(fadingLabel(3)).toBe("3 skills fading");
  });
});

describe("skillCountLabel", () => {
  it("pluralises the skill count", () => {
    expect(skillCountLabel(1)).toBe("1 skill");
    expect(skillCountLabel(8)).toBe("8 skills");
  });
});

describe("stageCountParts", () => {
  it("lists only stages with skills, in growth order", () => {
    expect(
      stageCountParts({ seed: 2, sprout: 0, sapling: 5, tree: 0, ancient: 1 }),
    ).toEqual([
      { stage: "seed", label: "2 seed" },
      { stage: "sapling", label: "5 sapling" },
      { stage: "ancient", label: "1 ancient tree" },
    ]);
  });
});

describe("buildCourseRows", () => {
  const courses: CourseProgress[] = [
    { packSlug: "a", status: "complete", completedAt: "2026-11-04T10:00:00Z" },
    { packSlug: "b", status: "not-started" },
  ];

  it("keeps path order and joins each course's live forest summary", () => {
    const forests = new Map([
      [
        "a",
        forest("a", [
          { stage: "sapling" },
          { stage: "sapling", wilting: true },
          { stage: "sprout" },
        ]),
      ],
      ["b", forest("b", [{ stage: "seed" }, { stage: "seed" }])],
    ]);

    const rows = buildCourseRows({ courses, forests });

    expect(rows.map((r) => [r.position, r.packSlug, r.name])).toEqual([
      [1, "a", "Pack a"],
      [2, "b", "Pack b"],
    ]);
    // recorded once: complete keeps its date even with a skill back at sprout
    expect(rows[0]).toMatchObject({
      status: "complete",
      completedAt: "2026-11-04T10:00:00Z",
      skillCount: 3,
      wiltingSkills: 1,
      stageCounts: { seed: 0, sprout: 1, sapling: 2, tree: 0, ancient: 0 },
    });
    expect(rows[1]).toMatchObject({
      status: "not-started",
      completedAt: null,
      skillCount: 2,
      wiltingSkills: 0,
    });
  });

  it("fails loud when a course has no forest", () => {
    expect(() => buildCourseRows({ courses, forests: new Map() })).toThrow(
      /no forest for a/,
    );
  });
});
