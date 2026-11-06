import {
  buildForest,
  FOREST_THRESHOLDS,
  summarizeForest,
} from "@/engine/forest";
import { type Attempt, memoryBySkill } from "@/engine/memory";
import type { Pack } from "@/engine/pack";
import {
  BOSS_STORM_SIZE,
  type StormResult,
  stormDurationSeconds,
  stormProof,
} from "@/engine/storm";
import { createRandom, type Random } from "./random";
import type {
  DemoWorld,
  Persona,
  PlannedAttempt,
  PlannedExpedition,
  PlannedJoin,
  PlannedLearner,
  PlannedReview,
  PlannedStorm,
  PlannedStormQuestion,
  SeedItem,
  SeedQuestion,
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;

interface Habit {
  /** First and last active day, counted back from `now` (21 = three weeks ago, 1 = yesterday). */
  fromDay: number;
  toDay: number;
  /** A session every N days. */
  every: number;
  perSession: number;
  accuracy: number;
  /** Only this many skills (a newcomer); null = every skill, round-robin. */
  skillLimit: number | null;
}

/**
 * MF-0029 LOOP-PLAN step 3: one habit per persona, tuned so frozen SC-3 holds through the engine.
 * The replay counts elapsed time in whole days (ts-fsrs), so a skill answered under 24 h ago reads
 * retrievability 1: only "strong" practises every skill yesterday; the crammer and the newcomer
 * stopped two days ago.
 */
export const PERSONA_HABITS = {
  steady: {
    fromDay: 21,
    toDay: 1,
    every: 2,
    perSession: 10,
    accuracy: 0.85,
    skillLimit: null,
  },
  you: {
    fromDay: 21,
    toDay: 1,
    every: 2,
    perSession: 8,
    accuracy: 0.8,
    // 20 of the 25 skills, so your own Today page shows seeds as well (SC-7).
    skillLimit: 20,
  },
  strong: {
    fromDay: 21,
    toDay: 1,
    every: 1,
    perSession: 25,
    accuracy: 0.95,
    skillLimit: null,
  },
  crammer: {
    fromDay: 4,
    toDay: 2,
    every: 1,
    perSession: 30,
    accuracy: 0.6,
    skillLimit: null,
  },
  lapsed: {
    fromDay: 21,
    toDay: 14,
    every: 2,
    perSession: 10,
    accuracy: 0.8,
    skillLimit: null,
  },
  new: {
    fromDay: 3,
    toDay: 2,
    every: 1,
    perSession: 4,
    accuracy: 0.5,
    skillLimit: 3,
  },
} as const satisfies Record<Persona, Habit>;

const DISPLAY_NAMES = {
  steady: "Ana Steady",
  crammer: "Bogdan Crammer",
  lapsed: "Carmen Lapsed",
  new: "Dan New",
  strong: "Elena Strong",
} as const satisfies Record<Exclude<Persona, "you">, string>;

const DEMO_PERSONAS = ["steady", "crammer", "lapsed", "new", "strong"] as const;

/** Reviewers tried in this order, so the reviews do not depend on the order of the item list. */
const REVIEWER_ORDER = [
  "new",
  "crammer",
  "lapsed",
  "steady",
  "strong",
] as const;

const FLAG_COMMENT =
  "Demo flag: one step reads ambiguously; please check it against the cited source.";

function shuffled<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = random.int(0, i);
    const a = out[i];
    const b = out[j];
    if (a === undefined || b === undefined) continue;
    out[i] = b;
    out[j] = a;
  }
  return out;
}

/** One answer: the key when correct, else one option outside the key (never equal to it as a set). */
function answer(
  question: SeedQuestion,
  random: Random,
  accuracy: number,
): { chosen: string[]; correct: boolean } {
  const wrong = question.optionIds.filter(
    (id) => !question.correctOptions.includes(id),
  );
  if (wrong.length === 0 || random.chance(accuracy))
    return { chosen: [...question.correctOptions], correct: true };
  return { chosen: [random.pick(wrong)], correct: false };
}

function planAttempts({
  learner,
  habit,
  now,
  random,
  bySkill,
  skills,
  packSlug,
}: {
  learner: PlannedLearner;
  habit: Habit;
  now: Date;
  random: Random;
  bySkill: ReadonlyMap<string, SeedQuestion[]>;
  skills: readonly string[];
  packSlug: string;
}): PlannedAttempt[] {
  const mine =
    habit.skillLimit === null
      ? shuffled(skills, random)
      : shuffled(skills, random).slice(0, habit.skillLimit);
  const attempts: PlannedAttempt[] = [];
  let cursor = 0;
  for (let day = habit.fromDay; day >= habit.toDay; day -= habit.every) {
    // A session starts 0–10 hours into its day (counted from `now`), so even day 1 ends before `now`.
    const start = now.getTime() - day * DAY_MS + random.int(0, 10) * HOUR_MS;
    for (let n = 0; n < habit.perSession; n++) {
      const skill = mine[cursor % mine.length];
      cursor += 1;
      const pool = skill ? bySkill.get(skill) : undefined;
      if (!skill || !pool || pool.length === 0) continue;
      const question = random.pick(pool);
      attempts.push({
        email: learner.email,
        questionId: question.questionId,
        skillCode: question.skillCode,
        packSlug,
        ...answer(question, random, habit.accuracy),
        answeredAt: new Date(
          Math.min(start + n * MINUTE_MS, now.getTime() - MINUTE_MS),
        ),
      });
    }
  }
  return attempts;
}

/**
 * MF-0029: the reviews follow `private.review_item`'s rules (the seed inserts them directly): a demo
 * reviewer, never the item's author, never a question they answered (a review spoils the reviewer's
 * later answers), the item's current hash. One question approved by two reviewers, one item flagged,
 * two single approvals. Throws when the inputs cannot provide them.
 */
export function planReviews({
  now,
  random,
  learners,
  attempts,
  items,
  excludeItemIds = [],
}: {
  now: Date;
  random: Random;
  learners: readonly PlannedLearner[];
  attempts: readonly PlannedAttempt[];
  items: readonly SeedItem[];
  /** Items a maintainer already resolved: reviewing them again is refused or invisible. */
  excludeItemIds?: readonly string[];
}): PlannedReview[] {
  const answered = new Map<string, Set<string>>();
  for (const t of attempts) {
    const set = answered.get(t.email) ?? new Set<string>();
    set.add(t.questionId);
    answered.set(t.email, set);
  }
  const reviewers = REVIEWER_ORDER.flatMap((persona) =>
    learners.filter((l) => l.persona === persona),
  );
  const excluded = new Set(excludeItemIds);
  const eligible = (reviewer: PlannedLearner, item: SeedItem): boolean =>
    !excluded.has(item.itemId) &&
    item.origin !== "official" &&
    item.authorEmail?.toLowerCase() !== reviewer.email &&
    !(
      item.itemType === "question" &&
      answered.get(reviewer.email)?.has(item.itemId)
    );
  const candidates = shuffled(
    [...items].sort((a, b) => (a.itemId < b.itemId ? -1 : 1)),
    random,
  );
  const createdAt = new Date(now.getTime() - DAY_MS);
  const used = new Set<string>();
  const review = (
    reviewer: PlannedLearner,
    item: SeedItem,
    verdict: "approve" | "flag",
  ): PlannedReview => ({
    reviewerEmail: reviewer.email,
    itemId: item.itemId,
    contentHash: item.contentHash,
    verdict,
    comment: verdict === "flag" ? FLAG_COMMENT : null,
    createdAt,
  });
  const out: PlannedReview[] = [];

  approvedPair: for (const item of candidates.filter(
    (i) => i.itemType === "question",
  )) {
    for (const [ia, a] of reviewers.entries())
      for (const b of reviewers.slice(ia + 1))
        if (eligible(a, item) && eligible(b, item)) {
          out.push(review(a, item, "approve"), review(b, item, "approve"));
          used.add(item.itemId);
          break approvedPair;
        }
  }
  if (out.length !== 2)
    throw new Error("planReviews: no question two demo reviewers can approve");

  // Flag an AI-written item: a flag hides its item from play, and the few human items are the showcase.
  const flagPool = [
    ...candidates.filter((i) => i.origin === "ai" && i.itemType !== "question"),
    ...candidates.filter((i) => i.origin === "ai" && i.itemType === "question"),
  ];
  const flag = flagPool.flatMap((item) =>
    used.has(item.itemId)
      ? []
      : reviewers.filter((r) => eligible(r, item)).map((r) => ({ r, item })),
  )[0];
  if (!flag) throw new Error("planReviews: no item a demo reviewer can flag");
  out.push(review(flag.r, flag.item, "flag"));
  used.add(flag.item.itemId);

  let singles = 0;
  for (const item of candidates.filter((i) => i.itemType === "question")) {
    if (singles === 2) break;
    if (used.has(item.itemId)) continue;
    const reviewer = reviewers[(singles + 2) % reviewers.length];
    if (!reviewer || !eligible(reviewer, item)) continue;
    out.push(review(reviewer, item, "approve"));
    used.add(item.itemId);
    singles += 1;
  }
  if (singles !== 2)
    throw new Error("planReviews: not enough items for two single approvals");
  return out;
}

/** MF-0034: how many of a pack's skills "you" practise (at most the MF-0029 cap), so a fifth stay seeds on Today. */
export function youSkillLimit(skillCount: number): number {
  return Math.min(
    PERSONA_HABITS.you.skillLimit,
    skillCount - Math.ceil(skillCount / 5),
  );
}

/** MF-0034: one demo group per pack, told apart by the pack's name. */
export function demoGroupName(packName: string): string {
  return `Demo study group · ${packName}`;
}

/**
 * MF-0029 SC-2, SC-3: the deterministic demo world for `now` and `seed`: five demo learners and you,
 * their answers over the last three weeks, the demo group and a few reviews. Pure: same inputs, same world.
 */
export function planDemoWorld({
  now,
  seed,
  packSlug,
  groupName = "Demo study group",
  youEmail,
  demoDomain,
  questions,
  items,
  excludeItemIds = [],
}: {
  now: Date;
  seed: number;
  packSlug: string;
  /** MF-0034: absent = "Demo study group" (MF-0029). */
  groupName?: string;
  youEmail: string;
  demoDomain: string;
  questions: SeedQuestion[];
  items: SeedItem[];
  excludeItemIds?: readonly string[];
}): DemoWorld {
  const random = createRandom(seed);
  const learners: PlannedLearner[] = [
    ...DEMO_PERSONAS.map((persona) => ({
      email: `${persona}@${demoDomain}`,
      displayName: DISPLAY_NAMES[persona],
      persona,
    })),
    { email: youEmail.toLowerCase(), displayName: "", persona: "you" as const },
  ];
  const own = questions.filter((q) => q.packSlug === packSlug);
  const bySkill = new Map<string, SeedQuestion[]>();
  for (const q of own)
    bySkill.set(q.skillCode, [...(bySkill.get(q.skillCode) ?? []), q]);
  const skills = [...bySkill.keys()];

  const attempts = learners.flatMap((learner) =>
    planAttempts({
      learner,
      habit:
        learner.persona === "you"
          ? { ...PERSONA_HABITS.you, skillLimit: youSkillLimit(skills.length) }
          : PERSONA_HABITS[learner.persona],
      now,
      random,
      bySkill,
      skills,
      packSlug,
    }),
  );
  const steady = learners[0];
  if (!steady) throw new Error("planDemoWorld: no demo learner");
  // MF-0052 SC-1: a day before the world's first answer, so tenure-scoped counts (expeditions) see every answer.
  const firstAnswer = Math.min(...attempts.map((t) => t.answeredAt.getTime()));
  if (!Number.isFinite(firstAnswer))
    throw new Error("planDemoWorld: no planned answer");
  return {
    learners,
    group: { name: groupName, packSlug, createdByEmail: steady.email },
    attempts,
    reviews: planReviews({
      now,
      random,
      learners,
      attempts,
      items,
      excludeItemIds,
    }),
    joins: learners.map((l) => ({
      email: l.email,
      joinedAt: new Date(firstAnswer - DAY_MS),
    })),
    // MF-0052: storms and expeditions are planned only by planDemoWorlds (MF-0029/MF-0034 tests count rows).
    storms: [],
    expedition: null,
  };
}

/** MF-0052: one pack's inputs to `planDemoWorlds`. */
export interface DemoPackInput {
  pack: Pack;
  groupName: string;
  questions: SeedQuestion[];
  items: SeedItem[];
}

/** Storms lie in [now − 10 d, now − 3 d − 1 h], so none enters the expedition window (starts now − 3 d). */
const STORM_FIRST_DAY = 10;
const EXPEDITION_START_DAY = 3;
const FULL_STORM_PROVEN_SKILLS = 4;
const MIN_FULL_STORM_PROVEN_SKILLS = 3;

function domainBySkill(pack: Pack): Map<string, string> {
  return new Map(
    pack.domains.flatMap((d) => d.skills.map((s) => [s.code, d.code] as const)),
  );
}

function isKey(question: SeedQuestion, chosen: readonly string[]): boolean {
  const a = new Set(chosen);
  const b = new Set(question.correctOptions);
  return a.size === b.size && [...a].every((x) => b.has(x));
}

/**
 * `start_storm`'s rule as the planner can see it: a question of this pack whose skill maps to a
 * domain, with a registry hash, not excluded, not flagged by any planned review, and not reviewed by
 * the storm's owner (a review spoils their answers). Grouped by skill, in pack-file order.
 */
function stormPool({
  world,
  input,
  email,
  excluded,
}: {
  world: DemoWorld;
  input: DemoPackInput;
  email: string;
  excluded: ReadonlySet<string>;
}): Map<string, SeedQuestion[]> {
  const domains = domainBySkill(input.pack);
  const hashes = new Map(
    input.items
      .filter((i) => i.itemType === "question")
      .map((i) => [i.itemId, i.contentHash]),
  );
  const flagged = new Set(
    world.reviews.filter((r) => r.verdict === "flag").map((r) => r.itemId),
  );
  const reviewedByOwner = new Set(
    world.reviews.filter((r) => r.reviewerEmail === email).map((r) => r.itemId),
  );
  const out = new Map<string, SeedQuestion[]>();
  for (const q of input.questions) {
    if (q.packSlug !== input.pack.slug) continue;
    if (!domains.has(q.skillCode) || !hashes.has(q.questionId)) continue;
    if (excluded.has(q.questionId) || flagged.has(q.questionId)) continue;
    if (reviewedByOwner.has(q.questionId)) continue;
    out.set(q.skillCode, [...(out.get(q.skillCode) ?? []), q]);
  }
  return out;
}

function plannedStorm({
  input,
  email,
  kind,
  domainCode,
  startedAt,
  answers,
}: {
  input: DemoPackInput;
  email: string;
  kind: PlannedStorm["kind"];
  domainCode: string | null;
  startedAt: Date;
  answers: readonly { question: SeedQuestion; chosen: string[] }[];
}): PlannedStorm {
  const { exam } = input.pack;
  if (!exam) throw new Error(`planDemoWorlds: ${input.pack.slug} has no exam`);
  const domains = domainBySkill(input.pack);
  const hashes = new Map(input.items.map((i) => [i.itemId, i.contentHash]));
  const durationMs = stormDurationSeconds(exam, answers.length) * 1000;
  // Answers spread inside the storm, the last one still before ends_at.
  const step = Math.floor(durationMs / (answers.length + 1));
  const questions: PlannedStormQuestion[] = answers.map(
    ({ question, chosen }, i) => ({
      questionId: question.questionId,
      skillCode: question.skillCode,
      domainCode: domains.get(question.skillCode) ?? "",
      contentHash: hashes.get(question.questionId) ?? "",
      chosen,
      chosenAt: new Date(startedAt.getTime() + (i + 1) * step),
    }),
  );
  return {
    email,
    kind,
    domainCode,
    startedAt,
    endsAt: new Date(startedAt.getTime() + durationMs),
    questions,
  };
}

/**
 * Your two storms. The Boss Storm proves every skill of one domain that already has stability
 * >= 14 d (a Boss proof alone never makes an Ancient, so they show as Trees, SC-4). The Full Storm
 * proves other skills and holds one wrong answer (SC-3). Only practised, non-wilting skills, so the
 * Walk keeps its water item and its never-answered skill (SC-7).
 */
function planYourStorms({
  world,
  input,
  youEmail,
  now,
  excluded,
}: {
  world: DemoWorld;
  input: DemoPackInput;
  youEmail: string;
  now: Date;
  excluded: ReadonlySet<string>;
}): PlannedStorm[] {
  const pool = stormPool({ world, input, email: youEmail, excluded });
  const memory = memoryBySkill(
    world.attempts.filter((t) => t.email === youEmail),
    now,
  );
  const t = FOREST_THRESHOLDS;
  const mine = input.pack.domains.flatMap((d) =>
    d.skills
      .map((s) => s.code)
      .filter((code) => {
        const m = memory.get(code);
        return (
          m !== undefined &&
          m.retrievability >= t.wiltBelowRetrievability &&
          (pool.get(code)?.length ?? 0) >= 2
        );
      })
      .map((code) => ({ code, domainCode: d.code })),
  );
  const stability = (code: string): number =>
    memory.get(code)?.stabilityDays ?? 0;

  let boss: { domainCode: string; skills: string[] } | null = null;
  for (const d of input.pack.domains) {
    const skills = mine
      .filter(
        (s) =>
          s.domainCode === d.code && stability(s.code) >= t.treeStabilityDays,
      )
      .map((s) => s.code);
    if (skills.length > 0 && skills.length > (boss?.skills.length ?? 0))
      boss = { domainCode: d.code, skills };
  }
  if (!boss)
    throw new Error(
      `planDemoWorlds: no domain of ${input.pack.slug} for your Boss Storm`,
    );
  const bossAnswers: { question: SeedQuestion; chosen: string[] }[] = [];
  for (const code of boss.skills) {
    const questions = pool.get(code) ?? [];
    if (bossAnswers.length + questions.length > BOSS_STORM_SIZE) continue;
    for (const question of questions)
      bossAnswers.push({ question, chosen: [...question.correctOptions] });
  }

  const bossSkills = new Set(boss.skills);
  const inBand = (code: string): boolean =>
    stability(code) >= t.treeStabilityDays &&
    stability(code) < t.ancientStabilityDays;
  const others = mine.filter((s) => !bossSkills.has(s.code));
  const proven = [
    ...others.filter((s) => inBand(s.code)),
    ...others.filter((s) => !inBand(s.code)),
  ].slice(0, FULL_STORM_PROVEN_SKILLS);
  if (proven.length < MIN_FULL_STORM_PROVEN_SKILLS)
    throw new Error(
      `planDemoWorlds: too few skills of ${input.pack.slug} for your Full Storm`,
    );
  const fullAnswers = proven.flatMap((s) =>
    (pool.get(s.code) ?? []).map((question) => ({
      question,
      chosen: [...question.correctOptions],
    })),
  );
  const used = new Set([...bossSkills, ...proven.map((s) => s.code)]);
  const wrong = others
    .filter((s) => !used.has(s.code))
    .flatMap((s) => pool.get(s.code) ?? [])
    .find((q) => q.optionIds.some((id) => !q.correctOptions.includes(id)));
  if (!wrong)
    throw new Error(
      `planDemoWorlds: no question of ${input.pack.slug} for your wrong answer`,
    );
  const wrongOption = wrong.optionIds.find(
    (id) => !wrong.correctOptions.includes(id),
  );
  fullAnswers.push({
    question: wrong,
    chosen: wrongOption ? [wrongOption] : [],
  });

  return [
    plannedStorm({
      input,
      email: youEmail,
      kind: "boss",
      domainCode: boss.domainCode,
      startedAt: new Date(now.getTime() - 5 * DAY_MS),
      answers: bossAnswers,
    }),
    plannedStorm({
      input,
      email: youEmail,
      kind: "full",
      domainCode: null,
      startedAt: new Date(now.getTime() - 4 * DAY_MS),
      answers: fullAnswers,
    }),
  ];
}

/** One Full Storm per demo learner: 10–15 of their eligible questions, answered at the persona's accuracy. */
function planDemoStorms({
  world,
  input,
  now,
  random,
  excluded,
}: {
  world: DemoWorld;
  input: DemoPackInput;
  now: Date;
  random: Random;
  excluded: ReadonlySet<string>;
}): PlannedStorm[] {
  const demo = world.learners.filter((l) => l.persona !== "you");
  return demo.map((learner, k) => {
    const pool = [
      ...stormPool({ world, input, email: learner.email, excluded }).values(),
    ]
      .flat()
      .sort((a, b) => (a.questionId < b.questionId ? -1 : 1));
    const picked = shuffled(pool, random).slice(0, random.int(10, 15));
    if (picked.length === 0)
      throw new Error(
        `planDemoWorlds: no storm question of ${input.pack.slug} for ${learner.email}`,
      );
    const accuracy =
      learner.persona === "you" ? 1 : PERSONA_HABITS[learner.persona].accuracy;
    return plannedStorm({
      input,
      email: learner.email,
      kind: "full",
      domainCode: null,
      startedAt: new Date(
        now.getTime() - STORM_FIRST_DAY * DAY_MS + k * 6 * HOUR_MS,
      ),
      answers: picked.map((question) => ({
        question,
        chosen: answer(question, random, accuracy).chosen,
      })),
    });
  });
}

/**
 * MF-0052 SC-5: the group's active expedition, started 3 days before `now`, on the domain with the most
 * correct answers `expedition_progress` will count (members, since it started, after joining; first
 * in pack order on a tie), with a target above that count so progress shows between 0 and the target.
 * Throws when no domain has a counted answer.
 */
// MF-0059: expeditions are open (no end), so every answer from startsAt on counts.
export function planExpedition({
  world,
  pack,
  now,
}: {
  world: DemoWorld;
  pack: Pack;
  now: Date;
}): PlannedExpedition {
  const startsAt = new Date(now.getTime() - EXPEDITION_START_DAY * DAY_MS);
  const domains = domainBySkill(pack);
  const joined = new Map(
    world.joins.map((j) => [j.email, j.joinedAt.getTime()]),
  );
  const counts = new Map<string, number>();
  for (const t of world.attempts) {
    const at = t.answeredAt.getTime();
    const domain = domains.get(t.skillCode);
    if (!t.correct || !domain || at < startsAt.getTime()) continue;
    if (at < (joined.get(t.email) ?? Number.POSITIVE_INFINITY)) continue;
    counts.set(domain, (counts.get(domain) ?? 0) + 1);
  }
  let best: { domainCode: string; count: number } | null = null;
  for (const d of pack.domains) {
    const count = counts.get(d.code) ?? 0;
    if (count > (best?.count ?? 0)) best = { domainCode: d.code, count };
  }
  if (!best)
    throw new Error(
      `planExpedition: no correct answer of ${pack.slug} inside the expedition window`,
    );
  const c = best.count;
  if (c >= 1000)
    throw new Error(`planExpedition: ${c} answers exceed the target range`);
  return {
    domainCode: best.domainCode,
    target: Math.min(1000, Math.max(10, c + Math.ceil(c / 2) + 1)),
    startsAt,
    createdByEmail: world.group.createdByEmail,
  };
}

/** Fail loud before any DB write: your seeded answers must grow at least one Tree (SC-4). */
function assertYouGrowATree({
  world,
  input,
  youEmail,
  now,
}: {
  world: DemoWorld;
  input: DemoPackInput;
  youEmail: string;
  now: Date;
}): void {
  const key = new Map(input.questions.map((q) => [q.questionId, q]));
  const graded = (q: PlannedStormQuestion): boolean => {
    const question = key.get(q.questionId);
    return (
      question !== undefined && q.chosen !== null && isKey(question, q.chosen)
    );
  };
  const yours = world.storms.filter((s) => s.email === youEmail);
  const attempts: Attempt[] = [
    ...world.attempts.filter((t) => t.email === youEmail),
    ...yours.flatMap((s) =>
      s.questions.flatMap((q) =>
        q.chosenAt
          ? [
              {
                questionId: q.questionId,
                skillCode: q.skillCode,
                correct: graded(q),
                answeredAt: q.chosenAt,
              },
            ]
          : [],
      ),
    ),
  ].sort((a, b) => a.answeredAt.getTime() - b.answeredAt.getTime());
  const results: StormResult[] = yours.map((s) => ({
    kind: s.kind,
    finishedAt: s.endsAt,
    questions: s.questions.map((q) => ({
      id: q.questionId,
      skillCode: q.skillCode,
      chosen: q.chosen,
      correct: q.chosen === null ? null : graded(q),
      voided: false,
    })),
  }));
  const summary = summarizeForest(
    buildForest(
      input.pack,
      memoryBySkill(attempts, now, stormProof(results, new Set())),
    ),
  );
  if (summary.stageCounts.tree < 1)
    throw new Error(
      `planDemoWorlds: your ${input.pack.slug} storms grow no Tree`,
    );
}

/**
 * MF-0052 SC-1, SC-3, SC-5, SC-7: the demo worlds of several packs planned together: each world as
 * `planDemoWorld`, plus backdated joins (an exam pack's group your newest), finished storms for exam
 * packs and one active expedition per group. Pure: same inputs, same worlds. Throws when a pack
 * cannot give the storms or the expedition, before anything is written.
 */
export function planDemoWorlds({
  now,
  seed,
  youEmail,
  demoDomain,
  packs,
  excludeItemIds = [],
}: {
  now: Date;
  seed: number;
  youEmail: string;
  demoDomain: string;
  packs: readonly DemoPackInput[];
  excludeItemIds?: readonly string[];
}): DemoWorld[] {
  const you = youEmail.toLowerCase();
  const excluded = new Set(excludeItemIds);
  const bases = packs.map((input) =>
    planDemoWorld({
      now,
      seed,
      packSlug: input.pack.slug,
      groupName: input.groupName,
      youEmail,
      demoDomain,
      questions: input.questions,
      items: input.items,
      excludeItemIds,
    }),
  );
  const firstAnswer = Math.min(
    ...bases.flatMap((w) => w.attempts.map((t) => t.answeredAt.getTime())),
  );
  const base = firstAnswer - DAY_MS;
  // Exam packs rank last, so your newest group (the dashboard's primary pack) is an exam pack.
  const ranked = packs
    .map((p) => p.pack)
    .sort(
      (a, b) =>
        Number(a.exam !== undefined && a.exam !== null) -
          Number(b.exam !== undefined && b.exam !== null) ||
        (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0),
    )
    .map((p) => p.slug);

  return bases.map((world, i) => {
    const input = packs[i];
    if (!input) throw new Error("planDemoWorlds: pack input missing");
    const joins: PlannedJoin[] = world.learners.map((l) => ({
      email: l.email,
      joinedAt: new Date(
        l.persona === "you"
          ? base + ranked.indexOf(input.pack.slug) * MINUTE_MS
          : base - HOUR_MS,
      ),
    }));
    const joined: DemoWorld = { ...world, joins };
    const storms = input.pack.exam
      ? [
          ...planDemoStorms({
            world: joined,
            input,
            now,
            random: createRandom((seed ^ 0x0052) >>> 0),
            excluded,
          }),
          ...planYourStorms({
            world: joined,
            input,
            youEmail: you,
            now,
            excluded,
          }),
        ]
      : [];
    const planned: DemoWorld = {
      ...joined,
      storms,
      expedition: planExpedition({ world: joined, pack: input.pack, now }),
    };
    if (storms.length > 0)
      assertYouGrowATree({ world: planned, input, youEmail: you, now });
    return planned;
  });
}
