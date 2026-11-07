import type { Confidence } from "@/engine/memory";

export interface ConfidenceTapProps {
  /** The pressed button, or null when the learner has not tapped. */
  value: Confidence | null;
  /** True after the verdict and while checking: the tap belongs to the answer already sent. */
  isLocked: boolean;
  onChoose: (confidence: Confidence) => void;
}
