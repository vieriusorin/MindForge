/**
 * MF-0059 acceptance (SC-6): `groupCourseStep({ path, currentPack })` says where a path group stands:
 * `{ position, total, next }` ("Course n of N" and the course "Move to next course" goes to).
 * Contract for "current pack not in the path" (edge table, C-3): the result is `null`, so the
 * screen shows "This group's course isn't in the path any more" and never "Course ? of N".
 * Rows and literals from the edge-input table in .planning/tasks/MF-0059/GOAL.md.
 */
import { describe, expect, it } from "vitest";
import { groupCourseStep, type PathContent } from "@/engine/path";

const PATH: PathContent = {
  slug: "claude-developer",
  name: "Claude Developer",
  source: "https://anthropic-partners.skilljar.com/path/claude-developer",
  courses: [
    "ai-capabilities",
    "platform-foundations",
    "claude-code-in-action",
    "agent-skills",
    "subagents",
  ],
};

describe("MF-0059 SC-6: groupCourseStep", () => {
  it("SC-6: current = position 1 of 5 → Course 1 of 5, next = platform-foundations", () => {
    expect(
      groupCourseStep({ path: PATH, currentPack: "ai-capabilities" }),
    ).toEqual({
      position: 1,
      total: 5,
      next: "platform-foundations",
    });
  });

  it("SC-6: a middle course → its position, next = the following course", () => {
    expect(
      groupCourseStep({ path: PATH, currentPack: "claude-code-in-action" }),
    ).toEqual({ position: 3, total: 5, next: "agent-skills" });
  });

  it("SC-6: position 4 of 5 → next = subagents (the last course)", () => {
    expect(
      groupCourseStep({ path: PATH, currentPack: "agent-skills" }),
    ).toEqual({
      position: 4,
      total: 5,
      next: "subagents",
    });
  });

  it("SC-6: current = position 5 of 5 → Course 5 of 5, next = null", () => {
    expect(groupCourseStep({ path: PATH, currentPack: "subagents" })).toEqual({
      position: 5,
      total: 5,
      next: null,
    });
  });

  it("SC-6: current pack no longer in the path → null (no position is shown)", () => {
    expect(
      groupCourseStep({ path: PATH, currentPack: "prod-prompting" }),
    ).toBeNull();
    expect(groupCourseStep({ path: PATH, currentPack: "ccdv-f" })).toBeNull();
  });

  it("SC-6: a one-course path → Course 1 of 1, next = null", () => {
    const single: PathContent = { ...PATH, courses: ["ai-capabilities"] };
    expect(
      groupCourseStep({ path: single, currentPack: "ai-capabilities" }),
    ).toEqual({
      position: 1,
      total: 1,
      next: null,
    });
  });
});
