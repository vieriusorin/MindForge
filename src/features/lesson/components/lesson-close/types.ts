import type { LessonOutcome } from "@/engine/lesson";

export interface LessonCloseProps {
  outcome: LessonOutcome;
  mapHref: string;
}

export interface ReviewLineProps {
  line: { text: string; zone: "UTC" | null };
}
