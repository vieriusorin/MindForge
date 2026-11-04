/**
 * MF-0029 acceptance (frozen): the local-only guard and the pure demo-world plan. Expected values are
 * literals from the Success Criteria in .planning/tasks/MF-0029/GOAL.md; the real pack files are read
 * at runtime and every figure is checked through the engine path the Today page uses.
 */
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { buildForest, summarizeForest } from "@/engine/forest";
import { memoryBySkill } from "@/engine/memory";
import { assertLocalSeedTarget } from "../guard";
import { loadSeedInputs } from "../load-seed-inputs";
import { planDemoWorld } from "../plan-demo-world";
import { PERSONAS, type PlannedAttempt } from "../types";

const PACK_DIR = join(process.cwd(), "packs/ccdv-f");
const NOW = new Date("2026-11-04T12:00:00.000Z");
const DAY = 24 * 60 * 60 * 1000;
const YOU = "me@example.com";
const DEMO = "mindforge-demo.test";
const LOCAL = "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

const sameSet = (a: readonly string[], b: readonly string[]): boolean =>
  new Set(a).size === new Set(b).size && a.every((x) => b.includes(x));

async function world(seed = 42) {
  const { pack, questions, items } = await loadSeedInputs(PACK_DIR);
  return {
    pack,
    questions,
    world: planDemoWorld({
      now: NOW,
      seed,
      packSlug: "ccdv-f",
      youEmail: YOU,
      demoDomain: DEMO,
      questions,
      items,
    }),
  };
}

describe("MF-0029 demo world (pure)", () => {
  it("SC-1: refuses a remote target, SUPABASE_DB_URL, or a missing / invalid MF_AUTHOR_EMAIL", () => {
    const env = { MF_AUTHOR_EMAIL: "Me@Example.com" };
    expect(assertLocalSeedTarget({ env, dbUrl: LOCAL })).toEqual({
      youEmail: "me@example.com",
    });
    expect(
      assertLocalSeedTarget({
        env,
        dbUrl: "postgresql://postgres:postgres@localhost:54322/postgres",
      }).youEmail,
    ).toBe("me@example.com");
    // `pnpm db:reset` runs scripts with an empty SUPABASE_DB_URL: empty means unset.
    expect(
      assertLocalSeedTarget({
        env: { ...env, SUPABASE_DB_URL: "" },
        dbUrl: LOCAL,
      }).youEmail,
    ).toBe("me@example.com");

    expect(() => assertLocalSeedTarget({ env: {}, dbUrl: LOCAL })).toThrow(
      /MF_AUTHOR_EMAIL/,
    );
    expect(() =>
      assertLocalSeedTarget({
        env: { MF_AUTHOR_EMAIL: "not-an-email" },
        dbUrl: LOCAL,
      }),
    ).toThrow(/MF_AUTHOR_EMAIL/);
    expect(() =>
      assertLocalSeedTarget({
        env: { ...env, SUPABASE_DB_URL: "postgres://x@example.com/db" },
        dbUrl: LOCAL,
      }),
    ).toThrow(/SUPABASE_DB_URL/);
    for (const remote of [
      "postgresql://postgres:pw@db.abcdefgh.supabase.co:5432/postgres",
      "postgresql://postgres:pw@10.0.0.5:5432/postgres",
      "not a url",
    ])
      expect(() => assertLocalSeedTarget({ env, dbUrl: remote })).toThrow(
        /local/i,
      );
  });

  it("SC-2: deterministic; 6 learners (5 personas + you); answers in the last 21 days, graded by the record_attempt rule", async () => {
    const a = await world(42);
    const b = await world(42);
    expect(b.world).toEqual(a.world);
    const other = await world(7);
    expect(other.world.attempts).not.toEqual(a.world.attempts);

    const { learners, attempts, group } = a.world;
    expect(learners).toHaveLength(6);
    expect(new Set(learners.map((l) => l.persona))).toEqual(new Set(PERSONAS));
    expect(new Set(learners.map((l) => l.email)).size).toBe(6);
    const you = learners.find((l) => l.persona === "you");
    expect(you?.email).toBe(YOU);
    for (const l of learners.filter((x) => x.persona !== "you")) {
      expect(l.email.endsWith(`@${DEMO}`)).toBe(true);
      expect(l.displayName.length).toBeGreaterThan(0);
      expect(l.displayName.length).toBeLessThanOrEqual(60);
    }

    expect(group.packSlug).toBe("ccdv-f");
    expect(group.createdByEmail.endsWith(`@${DEMO}`)).toBe(true);

    const keyOf = new Map(a.questions.map((q) => [q.questionId, q]));
    expect(attempts.length).toBeGreaterThan(0);
    for (const t of attempts) {
      expect(t.answeredAt.getTime()).toBeGreaterThanOrEqual(
        NOW.getTime() - 21 * DAY,
      );
      expect(t.answeredAt.getTime()).toBeLessThan(NOW.getTime());
      const key = keyOf.get(t.questionId);
      expect(key).toBeDefined();
      expect(t.skillCode).toBe(key?.skillCode);
      expect(t.packSlug).toBe("ccdv-f");
      expect(t.chosen.length).toBeGreaterThanOrEqual(1);
      for (const c of t.chosen) expect(key?.optionIds).toContain(c);
      expect(t.correct).toBe(sameSet(t.chosen, key?.correctOptions ?? []));
    }
    expect(attempts.some((t) => t.correct)).toBe(true);
    expect(attempts.some((t) => !t.correct)).toBe(true);
  });

  it("SC-3: through the engine at now — you and steady ≥ 3 saplings, lapsed ≥ 2 wilting, new ≥ 20 seeds, strong remembers best, nobody above sapling", async () => {
    const { pack, world: w } = await world(42);
    const byPersona = new Map(
      w.learners.map((l) => [
        l.persona,
        w.attempts.filter((t: PlannedAttempt) => t.email === l.email),
      ]),
    );
    const view = (persona: (typeof PERSONAS)[number]) => {
      const memory = memoryBySkill(
        (byPersona.get(persona) ?? []).map((t) => ({
          questionId: t.questionId,
          skillCode: t.skillCode,
          correct: t.correct,
          answeredAt: t.answeredAt,
        })),
        NOW,
      );
      const values = [...memory.values()].map((m) => m.retrievability);
      return {
        summary: summarizeForest(buildForest(pack, memory)),
        meanRetrievability:
          values.reduce((sum, r) => sum + r, 0) / Math.max(1, values.length),
      };
    };

    expect(view("steady").summary.stageCounts.sapling).toBeGreaterThanOrEqual(
      3,
    );
    expect(view("you").summary.stageCounts.sapling).toBeGreaterThanOrEqual(3);
    expect(view("lapsed").summary.wiltingSkills).toBeGreaterThanOrEqual(2);
    expect(view("new").summary.stageCounts.seed).toBeGreaterThanOrEqual(20);
    for (const persona of PERSONAS) {
      const { stageCounts } = view(persona).summary;
      expect(stageCounts.tree).toBe(0);
      expect(stageCounts.ancient).toBe(0);
    }
    const strong = view("strong").meanRetrievability;
    for (const persona of PERSONAS.filter((p) => p !== "strong"))
      expect(strong).toBeGreaterThan(view(persona).meanRetrievability);
  });
});
