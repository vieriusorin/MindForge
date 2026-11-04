import { isPlayable } from "../content/review";
import type { Pack, PackDomain, PackExamMeta } from "../pack/types";
import { allocateSeats } from "./largest-remainder";
import { seededRandom, shuffle } from "./seeded-random";
import type {
  StormCandidate,
  StormKind,
  StormPlan,
  StormPlanQuestion,
} from "./types";

export interface ComposeFullStormInput {
  readonly pack: Pack;
  readonly pool: readonly StormCandidate[];
  readonly seed: number;
}

export interface ComposeBossStormInput extends ComposeFullStormInput {
  readonly domainCode: string;
}

/** GOAL.md: a Boss Storm is 12 questions of one domain, or all playable if fewer. */
export const BOSS_STORM_SIZE = 12;

type ExamTiming = Pick<PackExamMeta, "questions" | "minutes">;

/** The exam's time per question, scaled to `questionCount` and rounded up to whole seconds. */
export function stormDurationSeconds(
  exam: ExamTiming,
  questionCount: number,
): number {
  return Math.ceil((questionCount * exam.minutes * 60) / exam.questions);
}

function examOf(pack: Pack): PackExamMeta {
  if (!pack.exam)
    throw new Error(`compose storm: pack "${pack.slug}" has no exam timing`);
  return pack.exam;
}

/**
 * Seat preference (GOAL.md "Facts found at freeze"): approved unseen → unreviewed unseen →
 * approved seen → unreviewed seen. Flagged, rejected and spoiled candidates never enter a tier.
 */
const TIER_COUNT = 4;

function tierOf(candidate: StormCandidate): number {
  const approved = candidate.state === "approved";
  if (!candidate.seenInStorm) return approved ? 0 : 1;
  return approved ? 2 : 3;
}

type SkillTiers = ReadonlyMap<string, readonly StormCandidate[][]>;

/** Per skill of the domain: its usable candidates, sorted by id, bucketed by tier, each tier shuffled. */
function tiersFor(
  domain: PackDomain,
  pool: readonly StormCandidate[],
  random: () => number,
): SkillTiers {
  const tiers = new Map<string, StormCandidate[][]>();
  for (const skill of domain.skills) {
    const usable = pool
      .filter(
        (c) =>
          c.skillCode === skill.code &&
          !c.spoiled &&
          isPlayable(c.state, "storm"),
      )
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    const buckets = Array.from({ length: TIER_COUNT }, (_, tier) =>
      shuffle(
        usable.filter((c) => tierOf(c) === tier),
        random,
      ),
    );
    tiers.set(skill.code, buckets);
  }
  return tiers;
}

function tierSize(tiers: SkillTiers, skillCode: string, tier: number): number {
  return tiers.get(skillCode)?.[tier]?.length ?? 0;
}

/** How many questions each skill takes from each tier, filling `seats` tier by tier (LOOP-PLAN step 18). */
function seatsBySkillAndTier(
  domain: PackDomain,
  seats: number,
  tiers: SkillTiers,
): Map<string, number[]> {
  const ideal = allocateSeats(
    seats,
    domain.skills.map((s) => ({
      key: s.code,
      weight: s.weight,
      capacity: Number.POSITIVE_INFINITY,
    })),
  );
  const taken = new Map<string, number[]>(
    domain.skills.map((s) => [s.code, Array<number>(TIER_COUNT).fill(0)]),
  );
  const total = (code: string): number =>
    (taken.get(code) ?? []).reduce((sum, n) => sum + n, 0);
  const add = (code: string, tier: number, n: number): void => {
    const row = taken.get(code);
    if (row) row[tier] = (row[tier] ?? 0) + n;
  };
  let remaining = seats;

  for (let tier = 0; tier < TIER_COUNT && remaining > 0; tier++) {
    if (tier > 0) {
      // A skill short in earlier tiers gets its own seats back first.
      const toDeficit = allocateSeats(
        remaining,
        domain.skills.map((s) => ({
          key: s.code,
          weight: Math.max(0, (ideal.get(s.code) ?? 0) - total(s.code)),
          capacity: tierSize(tiers, s.code, tier),
        })),
      );
      for (const [code, n] of toDeficit) {
        add(code, tier, n);
        remaining -= n;
      }
    }
    const byWeight = allocateSeats(
      remaining,
      domain.skills.map((s) => ({
        key: s.code,
        weight: s.weight,
        capacity:
          tierSize(tiers, s.code, tier) - (taken.get(s.code)?.[tier] ?? 0),
      })),
    );
    for (const [code, n] of byWeight) {
      add(code, tier, n);
      remaining -= n;
    }
  }
  return taken;
}

function pickDomain(
  domain: PackDomain,
  seats: number,
  pool: readonly StormCandidate[],
  random: () => number,
): StormPlanQuestion[] {
  const tiers = tiersFor(domain, pool, random);
  const counts = seatsBySkillAndTier(domain, seats, tiers);
  return domain.skills.flatMap((skill) =>
    (tiers.get(skill.code) ?? []).flatMap((bucket, tier) =>
      bucket.slice(0, counts.get(skill.code)?.[tier] ?? 0).map((c) => ({
        id: c.id,
        skillCode: c.skillCode,
        domainCode: domain.code,
        unreviewed: c.state === "unreviewed",
      })),
    ),
  );
}

function plan(input: {
  kind: StormKind;
  domainCode: string | null;
  exam: PackExamMeta;
  seats: readonly { domain: PackDomain; seats: number }[];
  pool: readonly StormCandidate[];
  seed: number;
}): StormPlan {
  const random = seededRandom(input.seed);
  const picks = input.seats.flatMap(({ domain, seats }) =>
    pickDomain(domain, seats, input.pool, random),
  );
  const questions = shuffle(picks, random);
  return {
    kind: input.kind,
    domainCode: input.domainCode,
    questions,
    durationSeconds: stormDurationSeconds(input.exam, questions.length),
  };
}

/** Planned seats per domain of a Full Storm: largest remainder of the exam's count by domain weight. */
export function fullStormDomainSeats(pack: Pack): Map<string, number> {
  return allocateSeats(
    examOf(pack).questions,
    pack.domains.map((d) => ({
      key: d.code,
      weight: d.weight,
      capacity: Number.POSITIVE_INFINITY,
    })),
  );
}

/**
 * MF-0013 SC-1/SC-2: the exam's blueprint split by domain, then by skill. A short skill passes its
 * seats to its domain's other skills; a domain short after every tier makes the storm shorter.
 * Throws when the pack has no exam timing. Same seed, same storm.
 */
export function composeFullStorm(input: ComposeFullStormInput): StormPlan {
  const exam = examOf(input.pack);
  const domainSeats = fullStormDomainSeats(input.pack);
  return plan({
    kind: "full",
    domainCode: null,
    exam,
    seats: input.pack.domains.map((domain) => ({
      domain,
      seats: domainSeats.get(domain.code) ?? 0,
    })),
    pool: input.pool,
    seed: input.seed,
  });
}

/** MF-0013 SC-2: `BOSS_STORM_SIZE` questions of one domain, or all playable if fewer. Throws on an unknown domain. */
export function composeBossStorm(input: ComposeBossStormInput): StormPlan {
  const exam = examOf(input.pack);
  const domain = input.pack.domains.find((d) => d.code === input.domainCode);
  if (!domain) {
    throw new Error(
      `composeBossStorm: pack "${input.pack.slug}" has no domain "${input.domainCode}"`,
    );
  }
  return plan({
    kind: "boss",
    domainCode: domain.code,
    exam,
    seats: [{ domain, seats: BOSS_STORM_SIZE }],
    pool: input.pool,
    seed: input.seed,
  });
}
