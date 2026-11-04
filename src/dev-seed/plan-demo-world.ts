import { createRandom, type Random } from "./random";
import type {
  DemoWorld,
  Persona,
  PlannedAttempt,
  PlannedLearner,
  PlannedReview,
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

/**
 * MF-0029 SC-2, SC-3: the deterministic demo world for `now` and `seed`: five demo learners and you,
 * their answers over the last three weeks, the demo group and a few reviews. Pure: same inputs, same world.
 */
export function planDemoWorld({
  now,
  seed,
  packSlug,
  youEmail,
  demoDomain,
  questions,
  items,
  excludeItemIds = [],
}: {
  now: Date;
  seed: number;
  packSlug: string;
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
      habit: PERSONA_HABITS[learner.persona],
      now,
      random,
      bySkill,
      skills,
      packSlug,
    }),
  );
  const steady = learners[0];
  if (!steady) throw new Error("planDemoWorld: no demo learner");
  return {
    learners,
    group: { name: "Demo study group", packSlug, createdByEmail: steady.email },
    attempts,
    reviews: planReviews({
      now,
      random,
      learners,
      attempts,
      items,
      excludeItemIds,
    }),
  };
}
