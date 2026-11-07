import type { LessonOutcome } from "@/engine/lesson";
import type { MixUp } from "@/engine/misconceptions";

export interface LessonCloseProps {
  outcome: LessonOutcome;
  mapHref: string;
  /** MF-0065 (DQ-12): the misconception picked most in this lesson, or none. */
  mixUp?: MixUp | null;
}

export interface ReviewLineProps {
  line: { text: string; zone: "UTC" | null };
}
