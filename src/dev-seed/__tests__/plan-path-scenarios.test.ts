import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { type PathContent, parsePath } from "@/engine/path";
import { loadSeedInputs } from "../load-seed-inputs";
import {
  type PathCourseInput,
  planPathScenarios,
  targetStatuses,
} from "../plan-path-scenarios";

const NOW = new Date("2026-11-06T12:00:00.000Z");
const ROOT = process.cwd();
let path: PathContent;
let courses: PathCourseInput[];

beforeAll(async () => {
  path = parsePath(
    await readFile(join(ROOT, "paths", "claude-developer.yaml"), "utf8"),
  );
  courses = [];
  for (const slug of path.courses) {
    const { pack, questions } = await loadSeedInputs(join(ROOT, "packs", slug));
    courses.push({ pack, questions });
  }
});

const base = () => ({
  now: NOW,
  seed: 42,
  youEmail: "me@example.com",
  demoDomain: "d.test",
  path,
  courses,
});

describe("targetStatuses", () => {
  it("names each persona's course statuses in path order", () => {
    expect(targetStatuses("fresh", 3)).toEqual([
      "not-started",
      "not-started",
      "not-started",
    ]);
    expect(targetStatuses("midpath", 4)).toEqual([
      "complete",
      "complete",
      "in-progress",
      "not-started",
    ]);
    expect(targetStatuses("lapsed-path", 3)).toEqual([
      "complete",
      "in-progress",
      "not-started",
    ]);
    expect(targetStatuses("finisher", 2)).toEqual(["complete", "complete"]);
  });
});

describe("planPathScenarios", () => {
  it("is deterministic for the same inputs", () => {
    expect(planPathScenarios(base())).toEqual(planPathScenarios(base()));
  });

  it("throws when a course of the path was not loaded", () => {
    expect(() =>
      planPathScenarios({ ...base(), courses: courses.slice(1) }),
    ).toThrow(/course ai-capabilities not loaded/);
  });

  it("throws when an excluded item leaves a skill with no playable question", () => {
    const first = courses[0];
    const skill = first?.pack.domains[0]?.skills[0]?.code;
    const ids = (first?.questions ?? [])
      .filter((q) => q.skillCode === skill)
      .map((q) => q.questionId);
    expect(ids.length).toBeGreaterThan(0);
    expect(() => planPathScenarios({ ...base(), excludeItemIds: ids })).toThrow(
      /has no playable question/,
    );
  });

  it("keeps excluded items out of every planned answer", () => {
    const excluded = (courses[1]?.questions ?? [])
      .slice(0, 2)
      .map((q) => q.questionId);
    const plan = planPathScenarios({ ...base(), excludeItemIds: excluded });
    expect(plan.attempts.some((t) => excluded.includes(t.questionId))).toBe(
      false,
    );
  });
});
