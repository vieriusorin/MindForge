/**
 * MF-0034 acceptance (frozen, pure half): which packs `pnpm dev:seed` fills, how many skills "you"
 * practise, and the per-pack demo group. Expected values are literals from .planning/tasks/MF-0034/GOAL.md.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadSeedInputs } from "../load-seed-inputs";
import {
  demoGroupName,
  planDemoWorld,
  youSkillLimit,
} from "../plan-demo-world";
import { resolveSeedPacks } from "../resolve-seed-packs";

const AVAILABLE = [
  { slug: "team-onboarding-sample", questionCount: 0 },
  { slug: "prod-prompting", questionCount: 54 },
  { slug: "ccdv-f", questionCount: 53 },
];

describe("MF-0034 seed every pack", () => {
  it("SC-1: no request = every pack with questions, sorted; a request = exactly those; unknown or empty packs refused", () => {
    expect(resolveSeedPacks({ available: AVAILABLE, requested: [] })).toEqual([
      "ccdv-f",
      "prod-prompting",
    ]);
    expect(
      resolveSeedPacks({
        available: AVAILABLE,
        requested: ["prod-prompting", "prod-prompting"],
      }),
    ).toEqual(["prod-prompting"]);
    expect(
      resolveSeedPacks({
        available: AVAILABLE,
        requested: ["prod-prompting", "ccdv-f"],
      }),
    ).toEqual(["ccdv-f", "prod-prompting"]);
    expect(() =>
      resolveSeedPacks({ available: AVAILABLE, requested: ["nope"] }),
    ).toThrow(/nope/);
    expect(() =>
      resolveSeedPacks({
        available: AVAILABLE,
        requested: ["team-onboarding-sample"],
      }),
    ).toThrow(/team-onboarding-sample/);
  });

  it("SC-2: you practise min(20, n − ceil(n/5)) skills", () => {
    expect(youSkillLimit(25)).toBe(20);
    expect(youSkillLimit(9)).toBe(7);
    expect(youSkillLimit(5)).toBe(4);
    expect(youSkillLimit(1)).toBe(0);
  });

  it("SC-3: per-pack group name; default unchanged; you answer 7 of prod-prompting's 9 skills", async () => {
    expect(demoGroupName("Production-Grade Prompting, Agents & Tool use")).toBe(
      "Demo study group · Production-Grade Prompting, Agents & Tool use",
    );
    const inputs = await loadSeedInputs(
      join(process.cwd(), "packs/prod-prompting"),
    );
    const base = {
      now: new Date("2026-11-04T12:00:00Z"),
      seed: 42,
      packSlug: "prod-prompting",
      youEmail: "you@example.test",
      demoDomain: "mf0034.test",
      questions: inputs.questions,
      items: inputs.items,
    };
    expect(planDemoWorld(base).group.name).toBe("Demo study group");
    const world = planDemoWorld({ ...base, groupName: "Named" });
    expect(world.group.name).toBe("Named");
    const yourSkills = new Set(
      world.attempts
        .filter((t) => t.email === "you@example.test")
        .map((t) => t.skillCode),
    );
    expect(yourSkills.size).toBe(7);
  });
});
