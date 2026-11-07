import type { Confidence } from "@/engine/memory";

/** MF-0065 (DQ-6): the tap after tapping `tapped`: the pressed button again clears it, the other replaces it. */
export function nextConfidence(
  current: Confidence | null,
  tapped: Confidence,
): Confidence | null {
  return current === tapped ? null : tapped;
}

/** MF-0065: the action input's confidence field, present only when the learner tapped. */
export function confidenceField(
  confidence: Confidence | null,
): { confidence: Confidence } | Record<string, never> {
  return confidence === null ? {} : { confidence };
}
