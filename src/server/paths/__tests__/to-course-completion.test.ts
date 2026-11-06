import { describe, expect, it } from "vitest";
import { toCourseCompletion } from "../to-course-completion";

describe("toCourseCompletion (MF-0058)", () => {
  it("maps a course_completions row to the engine's CourseCompletion, keeping the ISO date", () => {
    expect(
      toCourseCompletion({
        pack_slug: "subagents",
        completed_at: "2026-10-20T09:00:00+00:00",
        pack_version: 3,
      }),
    ).toEqual({
      packSlug: "subagents",
      completedAt: "2026-10-20T09:00:00+00:00",
      packVersion: 3,
    });
  });

  it("refuses a row that isn't a completion", () => {
    expect(() =>
      toCourseCompletion({ pack_slug: "subagents", pack_version: 0 }),
    ).toThrow();
  });
});
