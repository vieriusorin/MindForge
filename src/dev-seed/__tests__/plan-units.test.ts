import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { FOREST_THRESHOLDS } from "@/engine/forest";
import { memoryBySkill } from "@/engine/memory";
import { loadSeedInputs } from "../load-seed-inputs";
import {
  type DemoPackInput,
  planDemoWorld,
  planDemoWorlds,
  planExpedition,
  planReviews,
} from "../plan-demo-world";
import { createRandom } from "../random";
import type {
  DemoWorld,
  PlannedAttempt,
  PlannedLearner,
  SeedItem,
} from "../types";

const NOW = new Date("2026-11-04T12:00:00.000Z");
const AUTHOR = "author@example.com";
const learners: PlannedLearner[] = (
  ["steady", "crammer", "lapsed", "new", "strong"] as const
).map((persona) => ({
  email: `${persona}@d.test`,
  displayName: persona,
  persona,
}));

const item = (itemId: string, over: Partial<SeedItem> = {}): SeedItem => ({
  itemId,
  itemType: "question",
  skillCode: "D1.S1",
  origin: "ai",
  authorEmail: AUTHOR,
  contentHash: `h-${itemId}`,
  ...over,
});

const answeredBy = (email: string, questionId: string): PlannedAttempt => ({
  email,
  questionId,
  skillCode: "D1.S1",
  packSlug: "p",
  chosen: ["A"],
  correct: true,
  answeredAt: new Date(NOW.getTime() - 1000),
});

describe("planReviews (review_item's rules, applied by the planner)", () => {
  const items = [
    item("q1"),
    item("q2"),
    item("q3"),
    item("q4"),
    item("c1", { itemType: "card" }),
    item("off", { origin: "official", authorEmail: null }),
    item("mine", { authorEmail: "steady@d.test" }),
  ];

  it("plans 2 approvals on one question, 1 flag with a comment, 2 single approvals, at the current hash", () => {
    const reviews = planReviews({
      now: NOW,
      random: createRandom(1),
      learners,
      attempts: [],
      items,
    });
    expect(reviews.filter((r) => r.verdict === "flag")).toHaveLength(1);
    expect(reviews.find((r) => r.verdict === "flag")?.comment).toBeTruthy();
    const approvals = reviews.filter((r) => r.verdict === "approve");
    expect(approvals).toHaveLength(4);
    const perItem = new Map<string, number>();
    for (const r of approvals)
      perItem.set(r.itemId, (perItem.get(r.itemId) ?? 0) + 1);
    expect([...perItem.values()].sort()).toEqual([1, 1, 2]);
    for (const r of reviews) {
      expect(r.contentHash).toBe(`h-${r.itemId}`);
      expect(r.itemId).not.toBe("off");
      expect(r.createdAt.getTime()).toBeLessThan(NOW.getTime());
    }
  });

  it("flags an AI-written item, never a human one", () => {
    const reviews = planReviews({
      now: NOW,
      random: createRandom(5),
      learners,
      attempts: [],
      // The only non-question item is human: the old rule (cards and diagrams first) flagged it.
      items: [
        ...items.filter((i) => i.itemType === "question"),
        item("human-card", { itemType: "card", origin: "human" }),
      ],
    });
    const flagged = reviews.find((r) => r.verdict === "flag");
    expect(flagged?.itemId).not.toBe("human-card");
    expect(items.find((i) => i.itemId === flagged?.itemId)?.origin).toBe("ai");
  });

  it("never lets a learner review their own item or a question they answered", () => {
    const attempts = ["q1", "q2", "q3"].flatMap((q) => [
      answeredBy("new@d.test", q),
      answeredBy("crammer@d.test", q),
    ]);
    const reviews = planReviews({
      now: NOW,
      random: createRandom(3),
      learners,
      attempts,
      items,
    });
    for (const r of reviews) {
      expect(
        !(r.reviewerEmail === "steady@d.test" && r.itemId === "mine"),
      ).toBe(true);
      expect(
        attempts.some(
          (t) => t.email === r.reviewerEmail && t.questionId === r.itemId,
        ),
      ).toBe(false);
    }
  });

  it("keeps every review off items a maintainer already resolved", () => {
    const reviews = planReviews({
      now: NOW,
      random: createRandom(1),
      learners,
      attempts: [],
      items,
      excludeItemIds: ["q1", "c1"],
    });
    for (const r of reviews) expect(["q1", "c1"]).not.toContain(r.itemId);
  });

  it("throws when no question can take two approvals", () => {
    expect(() =>
      planReviews({
        now: NOW,
        random: createRandom(1),
        learners,
        attempts: [],
        items: [item("off", { origin: "official", authorEmail: null })],
      }),
    ).toThrow(/approve/);
  });
});

describe("planDemoWorlds (MF-0052 inner rules)", () => {
  const PLAN_NOW = new Date("2026-11-05T12:00:00.000Z");
  const YOU = "me@example.com";

  async function inputOf(slug: string): Promise<DemoPackInput> {
    const { pack, questions, items } = await loadSeedInputs(
      join(process.cwd(), "packs", slug),
    );
    return { pack, groupName: `Demo ${slug}`, questions, items };
  }

  async function planAll(
    slugs: readonly string[],
    excludeItemIds: readonly string[] = [],
  ): Promise<{ worlds: DemoWorld[]; inputs: DemoPackInput[] }> {
    const inputs = await Promise.all(slugs.map(inputOf));
    return {
      inputs,
      worlds: planDemoWorlds({
        now: PLAN_NOW,
        seed: 42,
        youEmail: YOU,
        demoDomain: "d.test",
        packs: inputs,
        excludeItemIds,
      }),
    };
  }

  function domainOf(input: DemoPackInput): Map<string, string> {
    return new Map(
      input.pack.domains.flatMap((d) =>
        d.skills.map((s) => [s.code, d.code] as const),
      ),
    );
  }

  it("makes the exam pack your newest join whatever the order, with two packs without an exam", async () => {
    for (const order of [
      ["subagents", "ccdv-f", "prod-prompting"],
      ["prod-prompting", "subagents", "ccdv-f"],
    ]) {
      const { worlds } = await planAll(order);
      const yours = worlds
        .map((w) => ({
          slug: w.group.packSlug,
          at: w.joins.find((j) => j.email === YOU)?.joinedAt.getTime() ?? 0,
        }))
        .sort((a, b) => b.at - a.at);
      expect(yours[0]?.slug).toBe("ccdv-f");
      expect(new Set(yours.map((y) => y.at)).size).toBe(3);
    }
  });

  it("keeps every storm question off items its owner reviews, any planned flag, and excluded items", async () => {
    const excluded = ["ccdv-f.D1.S1.q1", "ccdv-f.D3.S1.q1"];
    const { worlds } = await planAll(["ccdv-f"], excluded);
    const [world] = worlds;
    if (!world) throw new Error("no world");
    const flagged = new Set(
      world.reviews.filter((r) => r.verdict === "flag").map((r) => r.itemId),
    );
    expect(world.storms.length).toBeGreaterThan(0);
    for (const storm of world.storms)
      for (const q of storm.questions) {
        expect(excluded).not.toContain(q.questionId);
        expect(flagged.has(q.questionId)).toBe(false);
        expect(
          world.reviews.some(
            (r) => r.reviewerEmail === storm.email && r.itemId === q.questionId,
          ),
        ).toBe(false);
      }
  });

  it("binds each storm question to its registry hash and its skill's domain", async () => {
    const { worlds, inputs } = await planAll(["ccdv-f"]);
    const [world] = worlds;
    const [input] = inputs;
    if (!world || !input) throw new Error("no world");
    const hashes = new Map(input.items.map((i) => [i.itemId, i.contentHash]));
    const domains = domainOf(input);
    for (const storm of world.storms)
      for (const q of storm.questions) {
        expect(q.contentHash).toBe(hashes.get(q.questionId));
        expect(q.domainCode).toBe(domains.get(q.skillCode));
      }
  });

  it("ends every storm before the expedition window opens", async () => {
    const { worlds } = await planAll(["ccdv-f"]);
    const [world] = worlds;
    if (!world?.expedition) throw new Error("no expedition");
    for (const storm of world.storms)
      expect(storm.endsAt.getTime()).toBeLessThanOrEqual(
        world.expedition.startsAt.getTime(),
      );
  });

  it("never puts a skill you never answered, or one that is wilting, in your storms", async () => {
    const { worlds } = await planAll(["ccdv-f"]);
    const [world] = worlds;
    if (!world) throw new Error("no world");
    const practice = world.attempts.filter((t) => t.email === YOU);
    const memory = memoryBySkill(practice, PLAN_NOW);
    for (const storm of world.storms.filter((s) => s.email === YOU))
      for (const q of storm.questions) {
        const m = memory.get(q.skillCode);
        expect(m).toBeDefined();
        expect(m?.retrievability).toBeGreaterThanOrEqual(
          FOREST_THRESHOLDS.wiltBelowRetrievability,
        );
      }
  });

  it("sets each expedition's target above the correct answers it can count", async () => {
    const { worlds, inputs } = await planAll(["ccdv-f", "prod-prompting"]);
    for (const [i, world] of worlds.entries()) {
      const input = inputs[i];
      const expedition = world.expedition;
      if (!input || !expedition) throw new Error("no expedition");
      const domains = domainOf(input);
      const joined = new Map(
        world.joins.map((j) => [j.email, j.joinedAt.getTime()]),
      );
      const start = expedition.startsAt.getTime();
      const counted = world.attempts.filter(
        (t) =>
          t.correct &&
          domains.get(t.skillCode) === expedition.domainCode &&
          t.answeredAt.getTime() >= start &&
          t.answeredAt.getTime() >= (joined.get(t.email) ?? Infinity),
      ).length;
      expect(counted).toBeGreaterThan(0);
      expect(expedition.target).toBeGreaterThan(counted);
      expect(expedition.target).toBeGreaterThanOrEqual(10);
    }
  });

  it("throws when no domain has a correct answer inside the expedition window", async () => {
    const input = await inputOf("ccdv-f");
    const world = planDemoWorld({
      now: PLAN_NOW,
      seed: 42,
      packSlug: "ccdv-f",
      youEmail: YOU,
      demoDomain: "d.test",
      questions: input.questions,
      items: input.items,
    });
    expect(() =>
      planExpedition({
        world: {
          ...world,
          attempts: world.attempts.map((t) => ({ ...t, correct: false })),
        },
        pack: input.pack,
        now: PLAN_NOW,
      }),
    ).toThrow(/expedition/);
  });

  it("planDemoWorld plans no storm and no expedition, and joins everyone before the first answer", async () => {
    const input = await inputOf("ccdv-f");
    const world = planDemoWorld({
      now: PLAN_NOW,
      seed: 42,
      packSlug: "ccdv-f",
      youEmail: YOU,
      demoDomain: "d.test",
      questions: input.questions,
      items: input.items,
    });
    expect(world.storms).toEqual([]);
    expect(world.expedition).toBeNull();
    const first = Math.min(
      ...world.attempts.map((t) => t.answeredAt.getTime()),
    );
    expect(world.joins).toHaveLength(world.learners.length);
    for (const j of world.joins)
      expect(j.joinedAt.getTime()).toBeLessThan(first);
  });
});
