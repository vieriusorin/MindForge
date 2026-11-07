import { treeStage } from "../forest/tree-stage";
import type { Pack } from "../pack/types";
import type { Question } from "../questions/types";
import { confidentMissAt } from "./confident-miss";
import { memoryBySkill } from "./memory-by-skill";
import { orderSkillItems } from "./order-skill-items";
import type { Attempt } from "./types";

/** MF-0009: the Daily Walk's length cap. */
export const WALK_SIZE = 10;

/** Why a skill is in the walk: it needs water, it is a new seed, or it pads a short walk. */
export type WalkReason = "water" | "new" | "strengthen";

export interface WalkItem {
  question: Question;
  reason: WalkReason;
}

export interface WalkPlan {
  items: WalkItem[];
  /** Skills with a playable question that need water (wilting, or attempted but never recalled). Uncapped. */
  needWaterCount: number;
}

export interface WalkInput {
  pack: Pack;
  /** Playable candidates only; the caller filters by review state. */
  questions: readonly Question[];
  attempts: readonly Attempt[];
  now: Date;
}

interface Ranked {
  order: number;
  weight: number;
  score: number;
  question: Question;
}

const byScore = (a: Ranked, b: Ranked): number =>
  b.score - a.score || a.order - b.order;

/**
 * MF-0009: today's walk, one question per skill, at most WALK_SIZE. Skills that need water (MF-0065: or
 * whose latest answer was a confident miss) first
 * (by weight × (1 − R)), then at most one unseen skill (heaviest), then seen skills not due, which
 * only pad a walk that already has something to water or plant. Empty when there is neither.
 */
export function planWalk({
  pack,
  questions,
  attempts,
  now,
}: WalkInput): WalkPlan {
  const memory = memoryBySkill(attempts, now);
  const water: Ranked[] = [];
  // MF-0065 review should-fix 1: R ≈ 1 right after a lapse, so ranked by weight × (1 − R) a confident miss
  // would sort last and fall to the WALK_SIZE cut. It goes first instead (ADR 0007: the walk includes it).
  const confidentMisses: Ranked[] = [];
  const unseen: Ranked[] = [];
  const strengthen: Ranked[] = [];

  pack.domains
    .flatMap((d) => d.skills)
    .forEach((skill, order) => {
      const candidates = questions.filter((q) => q.skillCode === skill.code);
      // MF-0065 (DQ-11): the item last answered wrong first, then unseen, then least recently answered.
      const [first] = orderSkillItems(candidates, attempts);
      if (!first) return;
      const snapshot = memory.get(skill.code) ?? null;
      const ranked: Ranked = {
        order,
        weight: skill.weight,
        score: skill.weight * (1 - (snapshot?.retrievability ?? 0)),
        question: first,
      };
      if (snapshot === null) {
        unseen.push(ranked);
        return;
      }
      const tree = treeStage(snapshot);
      // MF-0065 (DQ-5): a confident miss is watered within 24 h, whatever FSRS says.
      const isConfidentMiss =
        confidentMissAt(attempts.filter((a) => a.skillCode === skill.code)) !==
        null;
      if (isConfidentMiss) confidentMisses.push(ranked);
      else if (tree.wilting || tree.stage === "seed") water.push(ranked);
      else strengthen.push(ranked);
    });

  confidentMisses.sort(byScore);
  water.sort(byScore);
  strengthen.sort(byScore);
  const newSeed = unseen.sort(
    (a, b) => b.weight - a.weight || a.order - b.order,
  )[0];

  const head: WalkItem[] = [
    ...[...confidentMisses, ...water].map((r) => ({
      question: r.question,
      reason: "water" as const,
    })),
    ...(newSeed
      ? [{ question: newSeed.question, reason: "new" as const }]
      : []),
  ];
  const items: WalkItem[] =
    head.length === 0
      ? []
      : [
          ...head,
          ...strengthen.map((r) => ({
            question: r.question,
            reason: "strengthen" as const,
          })),
        ].slice(0, WALK_SIZE);

  return {
    items,
    needWaterCount: confidentMisses.length + water.length,
  };
}
