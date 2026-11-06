/**
 * MF-0058 acceptance (SC-3): `pathProgress` returns, per course in path order, `complete` (with the
 * recorded date) | `in-progress` (at least one skill past seed) | `not-started`, plus
 * `completedCount`, `total`, `next` (the first non-complete course, or null) and `isPathComplete`.
 * A recorded completion stays complete whatever the live forest shows ("recorded once"). Rows and
 * literals from the edge-input table in .planning/tasks/MF-0058/GOAL.md.
 */
import { describe, expect, it } from "vitest";
import type { ForestView, TreeStage } from "@/engine/forest";
import {
  type CourseCompletion,
  type PathContent,
  pathProgress,
} from "@/engine/path";

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

const DATE_1 = "2026-10-20T09:00:00.000Z";
const DATE_2 = "2026-10-27T18:30:00.000Z";

function forest(packSlug: string, stages: readonly TreeStage[]): ForestView {
  return {
    packSlug,
    packName: packSlug,
    regions: [
      {
        domainCode: "D1",
        name: "Domain",
        weight: 100,
        trees: stages.map((stage, i) => ({
          skillCode: `D1.S${i + 1}`,
          name: `Skill ${i + 1}`,
          weight: 100 / stages.length,
          stage,
          wilting: false,
        })),
      },
    ],
  };
}

const SEEDS: TreeStage[] = ["seed", "seed", "seed"];
const SAPLINGS: TreeStage[] = ["sapling", "sapling", "sapling"];

/** Every course a forest of seeds unless overridden. */
function forests(
  over: Partial<Record<string, readonly TreeStage[]>> = {},
): Map<string, ForestView> {
  return new Map(
    PATH.courses.map((slug) => [slug, forest(slug, over[slug] ?? SEEDS)]),
  );
}

function done(packSlug: string, completedAt = DATE_1): CourseCompletion {
  return { packSlug, completedAt, packVersion: 1 };
}

function statuses(courses: readonly { packSlug: string; status: string }[]) {
  return courses.map((c) => [c.packSlug, c.status]);
}

describe("MF-0058 SC-3: pathProgress", () => {
  it("SC-3: no attempts anywhere: every course not-started, next is the first course", () => {
    const p = pathProgress({ path: PATH, completions: [], forests: forests() });
    expect(statuses(p.courses)).toEqual([
      ["ai-capabilities", "not-started"],
      ["platform-foundations", "not-started"],
      ["claude-code-in-action", "not-started"],
      ["agent-skills", "not-started"],
      ["subagents", "not-started"],
    ]);
    expect(p.completedCount).toBe(0);
    expect(p.total).toBe(5);
    expect(p.next).toBe("ai-capabilities");
    expect(p.isPathComplete).toBe(false);
  });

  it("SC-3: one skill planted (sprout), the rest seeds: in-progress", () => {
    const p = pathProgress({
      path: PATH,
      completions: [],
      forests: forests({ "ai-capabilities": ["sprout", "seed", "seed"] }),
    });
    expect(p.courses[0]).toMatchObject({
      packSlug: "ai-capabilities",
      status: "in-progress",
    });
    expect(p.next).toBe("ai-capabilities");
  });

  it("SC-3: every skill sapling except one sprout, no record: in-progress, not complete", () => {
    const p = pathProgress({
      path: PATH,
      completions: [],
      forests: forests({ "ai-capabilities": ["sapling", "sprout", "sapling"] }),
    });
    expect(p.courses[0]?.status).toBe("in-progress");
    expect(p.completedCount).toBe(0);
    expect(p.next).toBe("ai-capabilities");
  });

  it("SC-3: a complete course after an incomplete one keeps path order, counts, and next is the earlier one", () => {
    const p = pathProgress({
      path: PATH,
      completions: [done("platform-foundations", DATE_2)],
      forests: forests({
        "ai-capabilities": ["sprout", "seed", "seed"],
        "platform-foundations": SAPLINGS,
      }),
    });
    expect(statuses(p.courses)).toEqual([
      ["ai-capabilities", "in-progress"],
      ["platform-foundations", "complete"],
      ["claude-code-in-action", "not-started"],
      ["agent-skills", "not-started"],
      ["subagents", "not-started"],
    ]);
    expect(p.courses[1]).toMatchObject({ completedAt: DATE_2 });
    expect(p.completedCount).toBe(1);
    expect(p.total).toBe(5);
    expect(p.next).toBe("ai-capabilities");
    expect(p.isPathComplete).toBe(false);
  });

  it("SC-3: recorded complete, now a skill below sapling: still complete with its date", () => {
    const p = pathProgress({
      path: PATH,
      completions: [done("ai-capabilities", DATE_1)],
      forests: forests({ "ai-capabilities": ["sapling", "seed", "sapling"] }),
    });
    expect(p.courses[0]).toMatchObject({
      packSlug: "ai-capabilities",
      status: "complete",
      completedAt: DATE_1,
    });
    expect(p.completedCount).toBe(1);
    expect(p.next).toBe("platform-foundations");
  });

  it("SC-3: the pack gained a skill after the record (one seed now): still complete", () => {
    const p = pathProgress({
      path: PATH,
      completions: [
        { packSlug: "ai-capabilities", completedAt: DATE_1, packVersion: 1 },
      ],
      forests: forests({
        "ai-capabilities": ["sapling", "sapling", "sapling", "seed"],
      }),
    });
    expect(p.courses[0]).toMatchObject({
      status: "complete",
      completedAt: DATE_1,
    });
    expect(p.completedCount).toBe(1);
  });

  it("SC-3: courses completed before Start path count (the input has no enrollment)", () => {
    const p = pathProgress({
      path: PATH,
      completions: [done("ai-capabilities"), done("platform-foundations")],
      forests: forests({
        "ai-capabilities": SAPLINGS,
        "platform-foundations": SAPLINGS,
      }),
    });
    expect(p.completedCount).toBe(2);
    expect(p.next).toBe("claude-code-in-action");
  });

  it("SC-3: a completion for a pack outside the path is ignored", () => {
    const p = pathProgress({
      path: PATH,
      completions: [done("prod-prompting")],
      forests: forests(),
    });
    expect(p.completedCount).toBe(0);
    expect(p.total).toBe(5);
  });

  it("SC-3: all 5 complete: isPathComplete, next null", () => {
    const p = pathProgress({
      path: PATH,
      completions: PATH.courses.map((slug) => done(slug)),
      forests: forests(
        Object.fromEntries(PATH.courses.map((slug) => [slug, SAPLINGS])),
      ),
    });
    expect(p.courses.map((c) => c.status)).toEqual([
      "complete",
      "complete",
      "complete",
      "complete",
      "complete",
    ]);
    expect(p.completedCount).toBe(5);
    expect(p.total).toBe(5);
    expect(p.next).toBeNull();
    expect(p.isPathComplete).toBe(true);
  });
});
