import type { StormKind } from "@/engine/storm";

export interface StormStartProps {
  packSlug: string;
  kind: StormKind;
  /** Boss Storm only. */
  domainCode: string | null;
  /** The planned size; a short pool makes the storm shorter. */
  questionCount: number;
  /** The planned clock, from `stormDurationSeconds`. */
  durationSeconds: number;
}

export interface UseStormStartReturn {
  start: () => void;
  /** True from the click until the storm page loads, so Start can't fire twice. */
  isStarting: boolean;
  error: string | null;
}
