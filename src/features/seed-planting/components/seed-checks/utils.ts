import type { PlantingOutcome } from "./types";

/**
 * MF-0010 SC-4: a seed sprouts on its first DB-graded correct answer (`treeStage`: one successful
 * recall). A skill that was already growing just has its answers recorded.
 */
export function plantingOutcome({
  wasSeed,
  correctCount,
}: {
  wasSeed: boolean;
  correctCount: number;
}): PlantingOutcome {
  if (!wasSeed) return "recorded";
  return correctCount > 0 ? "sprouted" : "still-seed";
}

const OUTCOME_COPY = {
  sprouted: {
    title: "Your seed sprouted",
    description:
      "You recalled it correctly, so a sprout now grows in your forest. Water it on your daily walks.",
  },
  "still-seed": {
    title: "Still a seed",
    description:
      "Every answer is recorded, but a seed only sprouts from a correct recall. Read the card again and come back.",
  },
  recorded: {
    title: "Checks done",
    description:
      "Every answer is recorded. Your forest shows where this tree stands now.",
  },
} as const satisfies Record<
  PlantingOutcome,
  { title: string; description: string }
>;

/** The closing heading and line for an outcome. */
export function outcomeCopy(outcome: PlantingOutcome): {
  title: string;
  description: string;
} {
  return OUTCOME_COPY[outcome];
}
