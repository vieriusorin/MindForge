/**
 * MF-0052 acceptance (frozen, pure half): the demo worlds of ccdv-f and prod-prompting planned together.
 * Expected values are literals from the Success Criteria in .planning/tasks/MF-0052/GOAL.md; storm
 * answers are judged here against the pack's own answer key (set equality), never by the planner, and
 * the Walk is the real `planWalk` the Walk page and Today use.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackContent } from "@/engine/content";
import { type Attempt, planWalk } from "@/engine/memory";
import { loadSeedInputs } from "../load-seed-inputs";
import { type DemoPackInput, planDemoWorlds } from "../plan-demo-world";
import type { DemoWorld, PlannedStorm, SeedQuestion } from "../types";

const NOW = new Date("2026-11-05T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const YOU = "me@example.com";
const DEMO = "mindforge-demo.test";
const PACKS_DIR = join(process.cwd(), "packs");
/** ccdv-f `exam.questions`, and BOSS_STORM_SIZE: `start_storm`'s caps. */
const FULL_CAP = 53;
const BOSS_CAP = 12;

async function packInput(slug: string): Promise<DemoPackInput> {
  const { pack, questions, items } = await loadSeedInputs(
    join(PACKS_DIR, slug),
  );
  return { pack, groupName: `Demo ${slug}`, questions, items };
}

async function plan(order: readonly string[]): Promise<{
  worlds: DemoWorld[];
  inputs: Map<string, DemoPackInput>;
}> {
  const inputs = new Map<string, DemoPackInput>();
  for (const slug of order) inputs.set(slug, await packInput(slug));
  const worlds = planDemoWorlds({
    now: NOW,
    seed: 42,
    youEmail: YOU,
    demoDomain: DEMO,
    packs: [...inputs.values()],
  });
  return { worlds, inputs };
}

function worldOf(worlds: readonly DemoWorld[], slug: string): DemoWorld {
  const world = worlds.find((w) => w.group.packSlug === slug);
  if (!world) throw new Error(`no planned world for ${slug}`);
  return world;
}

/** The DB's rule (`private.options_match`): exact set equality with the key. */
function isCorrect(
  key: ReadonlyMap<string, SeedQuestion>,
  questionId: string,
  chosen: readonly string[],
): boolean {
  const q = key.get(questionId);
  if (!q) throw new Error(`no answer key for ${questionId}`);
  const a = new Set(chosen);
  const b = new Set(q.correctOptions);
  return a.size === b.size && [...a].every((x) => b.has(x));
}

function keyOf(input: DemoPackInput): Map<string, SeedQuestion> {
  return new Map(input.questions.map((q) => [q.questionId, q]));
}

/** Every answer a world will hold once seeded: practice attempts plus answered storm questions. */
function answerTimes(world: DemoWorld): number[] {
  return [
    ...world.attempts.map((t) => t.answeredAt.getTime()),
    ...world.storms.flatMap((s) =>
      s.questions.flatMap((q) => (q.chosenAt ? [q.chosenAt.getTime()] : [])),
    ),
  ];
}

function stormsOf(
  world: DemoWorld,
  email: string,
  kind: PlannedStorm["kind"],
): PlannedStorm[] {
  return world.storms.filter((s) => s.email === email && s.kind === kind);
}

describe("MF-0052 demo worlds planned together", () => {
  it("SC-1: every member joins before the world's first answer, and ccdv-f is your newest group in either pack order", async () => {
    for (const order of [
      ["ccdv-f", "prod-prompting"],
      ["prod-prompting", "ccdv-f"],
    ]) {
      const { worlds } = await plan(order);
      expect(worlds.map((w) => w.group.packSlug).sort()).toEqual([
        "ccdv-f",
        "prod-prompting",
      ]);
      for (const world of worlds) {
        const first = Math.min(...answerTimes(world));
        expect(Number.isFinite(first)).toBe(true);
        expect(world.joins.map((j) => j.email).sort()).toEqual(
          world.learners.map((l) => l.email).sort(),
        );
        for (const join of world.joins)
          expect(join.joinedAt.getTime()).toBeLessThan(first);
      }
      const yourJoin = (slug: string): number => {
        const join = worldOf(worlds, slug).joins.find((j) => j.email === YOU);
        if (!join) throw new Error(`you never join ${slug}`);
        return join.joinedAt.getTime();
      };
      expect(yourJoin("ccdv-f")).toBeGreaterThan(yourJoin("prod-prompting"));
    }
  });

  it("SC-3: ccdv-f plans you 1 Full + 1 Boss Storm and each demo learner 1 Full Storm, all ended before now; prod-prompting (no exam) plans none", async () => {
    const { worlds, inputs } = await plan(["ccdv-f", "prod-prompting"]);
    const ccdvf = worldOf(worlds, "ccdv-f");
    const input = inputs.get("ccdv-f");
    if (!input) throw new Error("no ccdv-f input");
    const domainCodes = input.pack.domains.map((d) => d.code);

    expect(stormsOf(ccdvf, YOU, "full")).toHaveLength(1);
    expect(stormsOf(ccdvf, YOU, "boss")).toHaveLength(1);
    const demo = ccdvf.learners.filter((l) => l.persona !== "you");
    expect(demo).toHaveLength(5);
    for (const learner of demo) {
      expect(stormsOf(ccdvf, learner.email, "full")).toHaveLength(1);
      expect(stormsOf(ccdvf, learner.email, "boss")).toHaveLength(0);
    }
    expect(ccdvf.storms).toHaveLength(7);
    expect(worldOf(worlds, "prod-prompting").storms).toEqual([]);

    for (const storm of ccdvf.storms) {
      // never left running: `finalize_storm` sets finished_at = least(now(), ends_at)
      expect(storm.endsAt.getTime()).toBeLessThanOrEqual(NOW.getTime());
      expect(storm.startedAt.getTime()).toBeLessThan(storm.endsAt.getTime());
      const ids = storm.questions.map((q) => q.questionId);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeGreaterThan(0);
      expect(ids.length).toBeLessThanOrEqual(
        storm.kind === "full" ? FULL_CAP : BOSS_CAP,
      );
      if (storm.kind === "boss") {
        expect(domainCodes).toContain(storm.domainCode);
        for (const q of storm.questions)
          expect(q.domainCode).toBe(storm.domainCode);
      } else expect(storm.domainCode).toBeNull();
      for (const q of storm.questions) {
        expect(q.chosen === null).toBe(q.chosenAt === null);
        if (!q.chosenAt) continue;
        expect(q.chosenAt.getTime()).toBeGreaterThanOrEqual(
          storm.startedAt.getTime(),
        );
        expect(q.chosenAt.getTime()).toBeLessThan(storm.endsAt.getTime());
      }
    }

    // your Full Storm proves >= 3 skills (>= 2 questions each, all right) and has >= 1 wrong answer
    const [full] = stormsOf(ccdvf, YOU, "full");
    if (!full) throw new Error("no Full Storm for you");
    const key = keyOf(input);
    const bySkill = new Map<string, boolean[]>();
    let wrong = 0;
    for (const q of full.questions) {
      const right = q.chosen !== null && isCorrect(key, q.questionId, q.chosen);
      if (q.chosen !== null && !right) wrong += 1;
      bySkill.set(q.skillCode, [...(bySkill.get(q.skillCode) ?? []), right]);
    }
    const proven = [...bySkill.values()].filter(
      (answers) => answers.length >= 2 && answers.every(Boolean),
    );
    expect(proven.length).toBeGreaterThanOrEqual(3);
    expect(wrong).toBeGreaterThanOrEqual(1);
  });

  it("SC-5: every world plans one expedition starting 3 days before now, on one of its pack's domains", async () => {
    const { worlds, inputs } = await plan(["ccdv-f", "prod-prompting"]);
    for (const world of worlds) {
      const input = inputs.get(world.group.packSlug);
      if (!input) throw new Error(`no input for ${world.group.packSlug}`);
      const expedition = world.expedition;
      expect(expedition).not.toBeNull();
      if (!expedition) continue;
      expect(expedition.startsAt.getTime()).toBe(NOW.getTime() - 3 * DAY);
      expect(input.pack.domains.map((d) => d.code)).toContain(
        expedition.domainCode,
      );
      expect(expedition.target).toBeGreaterThanOrEqual(10);
      expect(expedition.target).toBeLessThanOrEqual(1000);
    }
  });

  it("SC-7: your ccdv-f Walk (planWalk at now) has >= 1 water and >= 1 new skill, and >= 1 ccdv-f skill you never answered stays a seed", async () => {
    const { worlds, inputs } = await plan(["ccdv-f", "prod-prompting"]);
    const world = worldOf(worlds, "ccdv-f");
    const input = inputs.get("ccdv-f");
    if (!input) throw new Error("no ccdv-f input");
    const key = keyOf(input);
    const attempts: Attempt[] = [
      ...world.attempts
        .filter((t) => t.email === YOU)
        .map((t) => ({
          questionId: t.questionId,
          skillCode: t.skillCode,
          correct: t.correct,
          answeredAt: t.answeredAt,
        })),
      // finalize_storm turns every answered storm question into an attempt at its chosen_at
      ...world.storms
        .filter((s) => s.email === YOU)
        .flatMap((s) =>
          s.questions.flatMap((q) =>
            q.chosen && q.chosenAt
              ? [
                  {
                    questionId: q.questionId,
                    skillCode: q.skillCode,
                    correct: isCorrect(key, q.questionId, q.chosen),
                    answeredAt: q.chosenAt,
                  },
                ]
              : [],
          ),
        ),
    ].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());

    const content = await loadPackContent(
      input.pack,
      join(PACKS_DIR, "ccdv-f"),
    );
    const walk = planWalk({
      pack: input.pack,
      questions: content.questions,
      attempts,
      now: NOW,
    });
    const reasons = walk.items.map((i) => i.reason);
    expect(reasons).toContain("water");
    expect(reasons).toContain("new");

    const answered = new Set(attempts.map((a) => a.skillCode));
    const never = input.pack.domains
      .flatMap((d) => d.skills.map((s) => s.code))
      .filter((code) => !answered.has(code));
    expect(never.length).toBeGreaterThanOrEqual(1);
  });
});
