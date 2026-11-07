/**
 * MF-0068 acceptance (frozen, pure half): the path personas and path groups, planned for the real
 * `claude-developer` path over the real course packs. Expected values are literals from the Success Criteria
 * in .planning/tasks/MF-0068/GOAL.md. Every persona state is judged here through the engine
 * (memoryBySkill, buildForest, isCourseComplete, pathProgress, summarizeGroupHeatmap), never by the planner.
 */
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import {
  buildForest,
  type ForestView,
  summarizeGroupHeatmap,
} from "@/engine/forest";
import { type Attempt, memoryBySkill } from "@/engine/memory";
import type { Pack } from "@/engine/pack";
import {
  type CourseCompletion,
  isCourseComplete,
  type PathContent,
  parsePath,
  pathProgress,
} from "@/engine/path";
import { loadSeedInputs } from "../load-seed-inputs";
import {
  type DemoPackInput,
  planDemoWorld,
  planDemoWorlds,
} from "../plan-demo-world";
import {
  type PathCourseInput,
  planPathScenarios,
} from "../plan-path-scenarios";
import { planSeed } from "../plan-seed";
import type {
  PathScenarioPlan,
  PlannedAttempt,
  SeedItem,
  SeedQuestion,
} from "../types";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const YOU = "me@example.com";
const DEMO = "mindforge-demo.test";
const ROOT = process.cwd();
const PATH_SLUG = "claude-developer";
const COURSES = [
  "ai-capabilities",
  "platform-foundations",
  "claude-code-in-action",
  "agent-skills",
  "subagents",
] as const;
const PERSONAS = [
  "fresh",
  "halfway",
  "midpath",
  "finisher",
  "lapsed-path",
  "crammer-path",
] as const;
const emailOf = (persona: string): string => `${persona}@${DEMO}`;

let path: PathContent;
let courses: PathCourseInput[];
let packOf: Map<string, Pack>;
let questionsOf: Map<string, SeedQuestion[]>;
let planned: PathScenarioPlan | null = null;

beforeAll(async () => {
  path = parsePath(
    await readFile(join(ROOT, "paths", `${PATH_SLUG}.yaml`), "utf8"),
    `paths/${PATH_SLUG}.yaml`,
  );
  courses = [];
  for (const slug of COURSES) {
    const { pack, questions } = await loadSeedInputs(join(ROOT, "packs", slug));
    courses.push({ pack, questions });
  }
  packOf = new Map(courses.map((c) => [c.pack.slug, c.pack]));
  questionsOf = new Map(courses.map((c) => [c.pack.slug, c.questions]));
});

/** Planned on first use, so a planner that throws fails each SC on its own. */
function thePlan(): PathScenarioPlan {
  planned ??= planPathScenarios({
    now: NOW,
    seed: 42,
    youEmail: YOU,
    demoDomain: DEMO,
    path,
    courses,
  });
  return planned;
}

const toAttempt = (t: PlannedAttempt): Attempt => ({
  questionId: t.questionId,
  skillCode: t.skillCode,
  correct: t.correct,
  answeredAt: t.answeredAt,
});

function answersOf(persona: string, packSlug?: string): PlannedAttempt[] {
  return thePlan()
    .attempts.filter(
      (t) =>
        t.email === emailOf(persona) &&
        (packSlug === undefined || t.packSlug === packSlug),
    )
    .sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
}

function forestOf(persona: string, packSlug: string, at: Date): ForestView {
  const pack = packOf.get(packSlug);
  if (!pack) throw new Error(`no pack ${packSlug}`);
  const attempts = answersOf(persona, packSlug)
    .filter((t) => t.answeredAt.getTime() <= at.getTime())
    .map(toAttempt);
  return buildForest(pack, memoryBySkill(attempts, at));
}

function completionsOf(persona: string): CourseCompletion[] {
  return thePlan()
    .completions.filter((c) => c.email === emailOf(persona))
    .map((c) => ({
      packSlug: c.packSlug,
      completedAt: c.completedAt.toISOString(),
      packVersion: c.packVersion,
    }));
}

function progressOf(persona: string) {
  return pathProgress({
    path,
    completions: completionsOf(persona),
    forests: new Map(COURSES.map((s) => [s, forestOf(persona, s, NOW)])),
  });
}

const statuses = (persona: string): string[] =>
  progressOf(persona).courses.map((c) => c.status);

const trees = (forest: ForestView) => forest.regions.flatMap((r) => r.trees);

describe("MF-0068 path scenarios (plan)", () => {
  it("SC-1: six path personas on the demo domain, each enrolled once, nothing on your account", () => {
    expect(thePlan().learners.map((l) => l.email)).toEqual(
      PERSONAS.map(emailOf),
    );
    expect(thePlan().learners.map((l) => l.persona)).toEqual([...PERSONAS]);
    for (const l of thePlan().learners) {
      expect(l.displayName.length).toBeGreaterThan(0);
      expect(l.displayName.length).toBeLessThanOrEqual(60);
    }
    expect(thePlan().path.slug).toBe(PATH_SLUG);
    expect([...thePlan().path.courses]).toEqual([...COURSES]);
    expect(
      thePlan()
        .enrollments.map((e) => `${e.email}|${e.pathSlug}`)
        .sort(),
    ).toEqual(PERSONAS.map((p) => `${emailOf(p)}|${PATH_SLUG}`).sort());

    const emails = [
      ...thePlan().learners.map((l) => l.email),
      ...thePlan().enrollments.map((e) => e.email),
      ...thePlan().attempts.map((t) => t.email),
      ...thePlan().completions.map((c) => c.email),
      ...thePlan().groups.flatMap((g) => [
        g.createdByEmail,
        ...g.members.map((m) => m.email),
      ]),
    ];
    expect(emails.length).toBeGreaterThan(0);
    for (const email of emails) {
      expect(email).not.toBe(YOU);
      expect(email.endsWith(`@${DEMO}`)).toBe(true);
    }

    expect(() =>
      planPathScenarios({
        now: NOW,
        seed: 42,
        youEmail: "me@mindforge-demo.test",
        demoDomain: DEMO,
        path,
        courses,
      }),
    ).toThrow();
  });

  describe("SC-2: each persona's state, replayed through the engine at now", () => {
    it("fresh: no answers, 0 of 5, every course not started", () => {
      expect(answersOf("fresh")).toHaveLength(0);
      const p = progressOf("fresh");
      expect(p.completedCount).toBe(0);
      expect(p.next).toBe("ai-capabilities");
      expect(statuses("fresh")).toEqual(Array(5).fill("not-started"));
    });

    it("halfway: course 1 in progress with a skill partly answered, nothing complete", () => {
      expect(statuses("halfway")).toEqual([
        "in-progress",
        "not-started",
        "not-started",
        "not-started",
        "not-started",
      ]);
      expect(completionsOf("halfway")).toHaveLength(0);
      expect(isCourseComplete(forestOf("halfway", COURSES[0], NOW))).toBe(
        false,
      );
      const answered = new Map<string, Set<string>>();
      for (const t of answersOf("halfway", COURSES[0])) {
        const set = answered.get(t.skillCode) ?? new Set<string>();
        set.add(t.questionId);
        answered.set(t.skillCode, set);
      }
      const pool = questionsOf.get(COURSES[0]) ?? [];
      const partly = [...answered].filter(([skill, ids]) => {
        const total = pool.filter((q) => q.skillCode === skill).length;
        return ids.size > 0 && ids.size < total;
      });
      expect(partly.length).toBeGreaterThanOrEqual(1);
    });

    it("midpath: courses 1 and 2 complete, course 3 in progress, Course 3 of 5 next", () => {
      expect(
        completionsOf("midpath")
          .map((c) => c.packSlug)
          .sort(),
      ).toEqual(["ai-capabilities", "platform-foundations"].sort());
      expect(statuses("midpath")).toEqual([
        "complete",
        "complete",
        "in-progress",
        "not-started",
        "not-started",
      ]);
      expect(progressOf("midpath").nextPosition).toBe(3);
    });

    it("finisher: all five complete, the path complete at 100%", () => {
      expect(completionsOf("finisher")).toHaveLength(5);
      const p = progressOf("finisher");
      expect(p.isPathComplete).toBe(true);
      expect(p.completedPercent).toBe(100);
      expect(statuses("finisher")).toEqual(Array(5).fill("complete"));
    });

    it("lapsed-path: course 1 recorded complete but every tree wilting, nothing in 30 days, course 2 in progress", () => {
      expect(completionsOf("lapsed-path").map((c) => c.packSlug)).toEqual([
        "ai-capabilities",
      ]);
      const course1 = trees(forestOf("lapsed-path", COURSES[0], NOW));
      expect(course1.length).toBeGreaterThan(0);
      for (const tree of course1) {
        expect(["sapling", "tree", "ancient"]).toContain(tree.stage);
        expect(tree.wilting).toBe(true);
      }
      const last = answersOf("lapsed-path").at(-1);
      expect(last).toBeDefined();
      expect(
        NOW.getTime() - (last?.answeredAt.getTime() ?? NOW.getTime()),
      ).toBeGreaterThan(30 * DAY);
      expect(statuses("lapsed-path")).toEqual([
        "complete",
        "in-progress",
        "not-started",
        "not-started",
        "not-started",
      ]);
      expect(progressOf("lapsed-path").nextPosition).toBe(2);
    });

    it("crammer-path: 10+ correct in one day stays a Sprout, course 1 not complete", () => {
      expect(completionsOf("crammer-path")).toHaveLength(0);
      expect(statuses("crammer-path")[0]).toBe("in-progress");
      const forest = forestOf("crammer-path", COURSES[0], NOW);
      expect(isCourseComplete(forest)).toBe(false);
      const answeredSkills = new Set(
        answersOf("crammer-path", COURSES[0]).map((t) => t.skillCode),
      );
      expect(answeredSkills.size).toBeGreaterThan(0);
      for (const tree of trees(forest))
        if (answeredSkills.has(tree.skillCode))
          expect(tree.stage).toBe("sprout");
      const crammed = [...answeredSkills].some((skill) => {
        const correct = answersOf("crammer-path", COURSES[0]).filter(
          (t) => t.skillCode === skill && t.correct,
        );
        return correct.some(
          (first) =>
            correct.filter(
              (t) =>
                t.answeredAt.getTime() >= first.answeredAt.getTime() &&
                t.answeredAt.getTime() < first.answeredAt.getTime() + DAY,
            ).length >= 10,
        );
      });
      expect(crammed).toBe(true);
    });
  });

  it("SC-3: every completion was true when recorded; enrollments precede answers; answers before now", () => {
    expect(thePlan().completions.length).toBeGreaterThan(0);
    for (const c of thePlan().completions) {
      const persona = c.email.slice(0, c.email.indexOf("@"));
      expect(
        isCourseComplete(forestOf(persona, c.packSlug, c.completedAt)),
      ).toBe(true);
      expect(c.completedAt.getTime()).toBeLessThan(NOW.getTime());
      expect(c.packVersion).toBe(packOf.get(c.packSlug)?.version);
    }
    for (const t of thePlan().attempts)
      expect(t.answeredAt.getTime()).toBeLessThan(NOW.getTime());
    for (const e of thePlan().enrollments) {
      const first = thePlan()
        .attempts.filter((t) => t.email === e.email)
        .map((t) => t.answeredAt.getTime())
        .sort((a, b) => a - b)[0];
      if (first !== undefined)
        expect(e.startedAt.getTime()).toBeLessThanOrEqual(first);
      expect(e.startedAt.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it("SC-4: a six-member path group (heatmap ready) and a trio (heatmap not enough data)", () => {
    expect(thePlan().groups.map((g) => g.name)).toEqual([
      "Demo path group · Claude Developer",
      "Demo path trio · Claude Developer",
    ]);
    const [big, trio] = thePlan().groups;
    if (!big || !trio) throw new Error("two groups expected");
    for (const g of thePlan().groups) {
      expect(g.pathSlug).toBe(PATH_SLUG);
      expect(g.packSlug).toBe("ai-capabilities");
      expect(g.members.map((m) => m.email)).toContain(g.createdByEmail);
    }
    expect(big.members.map((m) => m.email).sort()).toEqual(
      PERSONAS.map(emailOf).sort(),
    );
    expect(big.members.length).toBeGreaterThanOrEqual(4);
    expect(trio.members.map((m) => m.email).sort()).toEqual(
      ["fresh", "halfway", "crammer-path"].map(emailOf).sort(),
    );
    const enrolled = new Set(thePlan().enrollments.map((e) => e.email));
    for (const g of thePlan().groups)
      for (const m of g.members) expect(enrolled.has(m.email)).toBe(true);

    const pack = packOf.get("ai-capabilities");
    if (!pack) throw new Error("no ai-capabilities");
    const memoryOf = (email: string) =>
      memoryBySkill(
        thePlan()
          .attempts.filter((t) => t.email === email && t.packSlug === pack.slug)
          .map(toAttempt),
        NOW,
      );
    const heatmapFor = (viewer: string, members: readonly string[]) =>
      summarizeGroupHeatmap({
        pack,
        viewer: memoryOf(viewer),
        others: members.filter((m) => m !== viewer).map(memoryOf),
      }).status;
    const trioEmails = trio.members.map((m) => m.email);
    for (const viewer of trioEmails)
      expect(heatmapFor(viewer, trioEmails)).toBe("not-enough-data");
    const bigEmails = big.members.map((m) => m.email);
    for (const viewer of bigEmails)
      expect(heatmapFor(viewer, bigEmails)).toBe("ready");
  });

  describe("SC-5: the existing demo world is unchanged", () => {
    it("(a) planSeed's worlds deep-equal planDemoWorlds alone", async () => {
      const packs: DemoPackInput[] = [];
      for (const slug of ["ccdv-f", ...COURSES]) {
        const { pack, questions, items } = await loadSeedInputs(
          join(ROOT, "packs", slug),
        );
        packs.push({ pack, groupName: `Demo ${slug}`, questions, items });
      }
      const alone = planDemoWorlds({
        now: NOW,
        seed: 42,
        youEmail: YOU,
        demoDomain: DEMO,
        packs,
      });
      const seeded = planSeed({
        now: NOW,
        seed: 42,
        youEmail: YOU,
        demoDomain: DEMO,
        packs,
        paths: [path],
      });
      expect(seeded.worlds).toEqual(alone);
      expect(seeded.pathScenario?.path.slug).toBe(PATH_SLUG);
      expect(seeded.skippedPaths).toEqual([]);

      const narrowed = planSeed({
        now: NOW,
        seed: 42,
        youEmail: YOU,
        demoDomain: DEMO,
        packs: packs.filter((p) => p.pack.slug === "ccdv-f"),
        paths: [path],
      });
      expect(narrowed.pathScenario).toBeNull();
      expect(narrowed.skippedPaths).toEqual([PATH_SLUG]);
    });

    it("(b) a fixture world hashes to the value recorded before MF-0068", () => {
      const skills = ["F.1", "F.2", "F.3", "F.4", "F.5"];
      const questions: SeedQuestion[] = skills.flatMap((skill) =>
        [1, 2, 3].map((n) => ({
          questionId: `fx-${skill}-q${n}`,
          skillCode: skill,
          packSlug: "fx",
          optionIds: ["A", "B", "C", "D"],
          correctOptions: ["B"],
        })),
      );
      const items: SeedItem[] = [
        ...questions.map((q) => ({
          itemId: q.questionId,
          itemType: "question" as const,
          skillCode: q.skillCode,
          origin: "ai" as const,
          authorEmail: "author@example.com",
          contentHash: `h-${q.questionId}`,
        })),
        ...[1, 2, 3, 4, 5, 6].map((n) => ({
          itemId: `fx-unplayed-q${n}`,
          itemType: "question" as const,
          skillCode: "F.1",
          origin: "ai" as const,
          authorEmail: "author@example.com",
          contentHash: `h-unplayed-${n}`,
        })),
        {
          itemId: "fx-card-1",
          itemType: "card" as const,
          skillCode: "F.1",
          origin: "ai" as const,
          authorEmail: "author@example.com",
          contentHash: "h-card-1",
        },
      ];
      const world = planDemoWorld({
        now: NOW,
        seed: 42,
        packSlug: "fx",
        youEmail: YOU,
        demoDomain: DEMO,
        questions,
        items,
      });
      const hash = createHash("sha256")
        .update(JSON.stringify(world))
        .digest("hex");
      expect(hash).toBe(
        "27f73e07331529495246ecf913cceaccfa0f1e9fd28d420de0939986a7539b5a",
      );
    });
  });
});
