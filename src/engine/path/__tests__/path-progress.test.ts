import { describe, expect, it } from "vitest";
import type { ForestView } from "../../forest/build-forest";
import type { TreeStage } from "../../forest/tree-stage";
import { pathProgress } from "../path-progress";
import type { CourseCompletion, PathContent } from "../types";

const PATH: PathContent = {
  slug: "p",
  name: "P",
  source: "https://example.com/p",
  courses: ["c1", "c2", "c3", "c4", "c5"],
};

function forest(packSlug: string, stages: readonly TreeStage[]): ForestView {
  return {
    packSlug,
    packName: packSlug,
    regions: [
      {
        domainCode: "D1",
        name: "D",
        weight: 100,
        trees: stages.map((stage, i) => ({
          skillCode: `S${i}`,
          name: `S${i}`,
          weight: 1,
          stage,
          wilting: false,
        })),
      },
    ],
  };
}

const done = (
  packSlug: string,
  completedAt = "2026-10-01T00:00:00.000Z",
): CourseCompletion => ({
  packSlug,
  completedAt,
  packVersion: 1,
});

const run = (
  completions: readonly CourseCompletion[],
  forests = new Map<string, ForestView>(),
) => pathProgress({ path: PATH, completions, forests });

describe("pathProgress", () => {
  it("nextPosition is 1 with no completions", () => {
    expect(run([]).nextPosition).toBe(1);
  });

  it("nextPosition is 3 when courses 1 and 2 are complete", () => {
    expect(run([done("c1"), done("c2")]).nextPosition).toBe(3);
  });

  it("nextPosition is null when every course is complete", () => {
    expect(run(PATH.courses.map((c) => done(c))).nextPosition).toBeNull();
  });

  it("completedPercent is 0 / 40 / 100 for 0 / 2 / 5 of 5", () => {
    expect(run([]).completedPercent).toBe(0);
    expect(run([done("c1"), done("c4")]).completedPercent).toBe(40);
    expect(run(PATH.courses.map((c) => done(c))).completedPercent).toBe(100);
  });

  it("completedPercent is a whole number", () => {
    const three: PathContent = { ...PATH, courses: ["c1", "c2", "c3"] };
    const p = pathProgress({
      path: three,
      completions: [done("c1")],
      forests: new Map(),
    });
    expect(p.completedPercent).toBe(33);
  });

  it("completedAt is the latest course date once the path is complete", () => {
    const completions = PATH.courses.map((c) =>
      done(c, "2026-10-01T00:00:00.000Z"),
    );
    completions[2] = done("c3", "2026-10-09T12:00:00.000Z");
    expect(run(completions).completedAt).toBe("2026-10-09T12:00:00.000Z");
  });

  it("completedAt is null while the path is incomplete", () => {
    expect(
      run([done("c1", "2026-10-09T12:00:00.000Z")]).completedAt,
    ).toBeNull();
  });

  it("a course missing from forests counts as not-started", () => {
    expect(run([]).courses[0]).toEqual({
      packSlug: "c1",
      status: "not-started",
    });
  });

  it("a course with a tree past seed is in-progress", () => {
    const p = run([], new Map([["c2", forest("c2", ["seed", "sprout"])]]));
    expect(p.courses[1]).toEqual({ packSlug: "c2", status: "in-progress" });
  });
});
