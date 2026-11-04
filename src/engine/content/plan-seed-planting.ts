import type { Question } from "../questions/types";
import { isPlayable, reviewStateOf } from "./review";
import type {
  Diagram,
  NatureCard,
  Origin,
  PackContent,
  ReviewContext,
  SeedPlanting,
} from "./types";

/** MF-0010: at most this many quick checks per skill (C-3: fewer when the skill has fewer). */
export const SEED_CHECK_COUNT = 3;

export interface PlanSeedPlantingInput {
  content: PackContent;
  review: ReviewContext;
  skill: string;
}

/** Approved before unreviewed; null = never served (flagged, rejected). */
function rankOf(
  review: ReviewContext,
  item: { id: string; origin: Origin },
): number | null {
  const state = reviewStateOf(review, item);
  if (!isPlayable(state, "practice")) return null;
  return state === "approved" ? 0 : 1;
}

/** Code-point order, so the tie-break never depends on the runtime's locale. */
function compareIds(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

/** Playable items, best rank first; ties break by id or keep file order. */
function ranked<T extends { id: string; origin: Origin }>(
  items: readonly T[],
  review: ReviewContext,
  tieBreak: "id" | "file-order",
): T[] {
  return items
    .map((item) => ({ item, rank: rankOf(review, item) }))
    .filter((x): x is { item: T; rank: number } => x.rank !== null)
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        (tieBreak === "id" ? compareIds(a.item.id, b.item.id) : 0),
    )
    .map((x) => x.item);
}

/**
 * MF-0010 SC-6: the card, diagram and checks a learner meets when planting `skill`. The diagram is
 * the chosen card's link when playable, else the skill's best playable diagram; a skill with
 * neither card nor diagram plants with its checks alone.
 */
export function planSeedPlanting({
  content,
  review,
  skill,
}: PlanSeedPlantingInput): SeedPlanting {
  const card: NatureCard | null =
    ranked(
      content.cards.filter((c) => c.skill === skill),
      review,
      "id",
    )[0] ?? null;

  const diagrams = ranked(
    content.diagrams.filter((d) => d.skill === skill),
    review,
    "id",
  );
  const diagram: Diagram | null =
    diagrams.find((d) => d.id === card?.diagram) ?? diagrams[0] ?? null;

  const checks: Question[] = ranked(
    content.questions.filter((q) => q.skillCode === skill),
    review,
    "file-order",
  ).slice(0, SEED_CHECK_COUNT);

  return { card, diagram, checks };
}
