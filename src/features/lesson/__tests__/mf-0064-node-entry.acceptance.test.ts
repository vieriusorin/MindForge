/**
 * MF-0064 acceptance (SC-5): the course map's node entry is retargeted through `startNodeHref` only
 * (MF-0062 contract, D-L2): Seed / Sprout / fading nodes open the lesson for that skill, Sapling+ keeps
 * the Scenario Duel. And the gap MF-0062's review found: the "Water first" node names a skill, so the
 * lesson its link opens must recall that skill (the Daily Walk could leave it out).
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { emptyReviewContext } from "@/engine/content";
import { planLesson } from "@/engine/lesson";
import type { Attempt } from "@/engine/memory";
import type { Pack } from "@/engine/pack";
import { courseForest, nextStep } from "@/engine/path";
import type { Question } from "@/engine/questions";
import {
  NODE_MODE_LABEL,
  startNodeHref,
} from "@/features/course-map/utils/start-node";

const PLAY = join(process.cwd(), "src", "app", "(app)", "play", "[packSlug]");

const PACK: Pack = {
  slug: "demo",
  name: "Demo",
  kind: "course",
  version: 1,
  domains: [
    {
      code: "A",
      name: "Domain A",
      weight: 100,
      skills: [
        { code: "A.1", name: "Light skill", weight: 20 },
        { code: "A.2", name: "Heavy skill", weight: 80 },
      ],
    },
  ],
};

function question(id: string, skillCode: string): Question {
  return {
    id,
    skillCode,
    origin: "ai",
    stem: `Stem ${id}`,
    select: 1,
    options: ["A", "B", "C", "D"].map((o, i) => ({
      id: o,
      text: o,
      correct: i === 0,
      rationale: o,
    })),
    source: { title: "Doc", url: "https://example.com/doc" },
  };
}

describe("MF-0064 SC-5: node entry opens the skill's lesson", () => {
  it("SC-5: plant and walk open the lesson for that skill (code URL-encoded); duel keeps the Duel", () => {
    expect(
      startNodeHref({ packSlug: "ccdv-f", skillCode: "D1.S2", mode: "plant" }),
    ).toBe("/play/ccdv-f/lesson/D1.S2");
    expect(
      startNodeHref({ packSlug: "demo", skillCode: "a b/c", mode: "walk" }),
    ).toBe("/play/demo/lesson/a%20b%2Fc");
    expect(
      startNodeHref({ packSlug: "demo", skillCode: "x", mode: "duel" }),
    ).toBe("/play/demo/duel");
  });

  it("SC-5: both lesson modes are labelled Lesson", () => {
    expect(NODE_MODE_LABEL).toEqual({
      plant: "Lesson",
      walk: "Lesson",
      duel: "Scenario Duel",
    });
  });

  it("SC-5: the lesson and its close screen exist as routes", () => {
    expect(existsSync(join(PLAY, "lesson", "[skill]", "page.tsx"))).toBe(true);
    expect(
      existsSync(join(PLAY, "lesson", "[skill]", "done", "page.tsx")),
    ).toBe(true);
  });

  it("SC-5: the Water first node's lesson recalls that skill", () => {
    const now = new Date("2026-11-07T12:00:00Z");
    // A.1 answered once, 10 days ago: a fading Sprout. A.2 never answered.
    const attempts: Attempt[] = [
      {
        questionId: "A.1.q1",
        skillCode: "A.1",
        correct: true,
        answeredAt: new Date("2026-10-28T12:00:00Z"),
      },
    ];
    const review = emptyReviewContext();
    const forest = courseForest({
      pack: PACK,
      attempts,
      review,
      stormResults: [],
      now,
    });
    const step = nextStep(forest);
    expect(step).toEqual({ kind: "water", skillCode: "A.1" });
    if (step.kind !== "water") return;

    const href = startNodeHref({
      packSlug: "demo",
      skillCode: step.skillCode,
      mode: "walk",
    });
    const skillCode = decodeURIComponent(href.split("/").at(-1) ?? "");
    expect(href).toBe("/play/demo/lesson/A.1");

    const plan = planLesson({
      skillCode,
      forest,
      content: {
        questions: [
          question("A.1.q1", "A.1"),
          question("A.1.q2", "A.1"),
          question("A.2.q1", "A.2"),
        ],
        cards: [],
        diagrams: [],
      },
      review,
      attempts,
    });
    const recalls = plan.steps.filter((s) => s.kind === "recall");
    expect(recalls.length).toBeGreaterThan(0);
    for (const s of recalls) {
      if (s.kind === "recall") expect(s.question.skillCode).toBe("A.1");
    }
  });
});
