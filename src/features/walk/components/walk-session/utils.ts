import type { WalkReason } from "@/engine/memory";

const REASON_LABEL = {
  water: "Needs water",
  new: "New seed",
  strengthen: "Strengthen",
} as const satisfies Record<WalkReason, string>;

/** The badge that tells the learner why this skill is in today's walk. */
export function reasonLabel(reason: WalkReason): string {
  return REASON_LABEL[reason];
}
