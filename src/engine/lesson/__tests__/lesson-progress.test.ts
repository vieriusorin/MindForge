import { describe, expect, it } from "vitest";
import { lessonProgress } from "../lesson-progress";

describe("lessonProgress", () => {
  it("marks earlier steps done, the current one current, the rest todo", () => {
    expect(lessonProgress({ index: 1, total: 4 })).toEqual({
      position: 2,
      total: 4,
      segments: ["done", "current", "todo", "todo"],
    });
  });

  it("the first and last steps", () => {
    expect(lessonProgress({ index: 0, total: 2 }).segments).toEqual([
      "current",
      "todo",
    ]);
    expect(lessonProgress({ index: 1, total: 2 })).toMatchObject({
      position: 2,
      segments: ["done", "current"],
    });
  });

  it("an index past the end stays on the last step; no steps reads 0 of 0", () => {
    expect(lessonProgress({ index: 5, total: 3 }).position).toBe(3);
    expect(lessonProgress({ index: 0, total: 0 })).toEqual({
      position: 0,
      total: 0,
      segments: [],
    });
  });
});
