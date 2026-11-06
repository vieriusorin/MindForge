import { describe, expect, it } from "vitest";
import { groupCourseStep } from "@/engine/path";
import { pathCardView } from "../utils";

const PATH = {
  name: "Claude Developer",
  courses: ["c1", "c2", "c3", "c4", "c5"],
};
const PACK_NAMES = {
  c1: "AI Capabilities",
  c2: "Platform Foundations",
  c3: "Claude Code in Action",
  c4: "Agent Skills",
  c5: "Subagents",
};

function view(
  currentPack: string,
  packNames: Record<string, string> = PACK_NAMES,
) {
  return pathCardView({
    path: PATH,
    step: groupCourseStep({
      path: {
        slug: "claude-developer",
        source: "https://example.com",
        ...PATH,
      },
      currentPack,
    }),
    packNames,
  });
}

describe("pathCardView", () => {
  it("marks the first course current and offers the second next", () => {
    const v = view("c1");
    expect(v.title).toBe("Claude Developer path");
    expect(v.positionLine).toBe("Course 1 of 5");
    expect(v.rows.map((r) => r.isCurrent)).toEqual([
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(v.rows[0]).toEqual({
      slug: "c1",
      name: "AI Capabilities",
      isCurrent: true,
    });
    expect(v.nextCourseName).toBe("Platform Foundations");
    expect(v.moveDisabledReason).toBeNull();
  });

  it("disables the move at the last course", () => {
    const v = view("c5");
    expect(v.positionLine).toBe("Course 5 of 5");
    expect(v.rows[4]?.isCurrent).toBe(true);
    expect(v.nextCourseName).toBeNull();
    expect(v.moveDisabledReason).toBe("Last course of the path");
  });

  it("marks nothing when the group's course left the path", () => {
    const v = view("gone");
    expect(v.positionLine).toBe(
      "This group's course isn't in the path any more",
    );
    expect(v.rows.some((r) => r.isCurrent)).toBe(false);
    expect(v.rows).toHaveLength(5);
    expect(v.nextCourseName).toBeNull();
    expect(v.moveDisabledReason).toBe(
      "This group's course isn't in the path any more",
    );
  });

  it("names a course by its slug when its pack has no name", () => {
    const v = view("c1", { c1: "AI Capabilities" });
    expect(v.rows[1]?.name).toBe("c2");
    expect(v.nextCourseName).toBe("c2");
  });
});
