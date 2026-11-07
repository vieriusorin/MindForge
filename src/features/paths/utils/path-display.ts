import type { PathProgress } from "@/engine/path";

const COMPLETED_DATE = new Intl.DateTimeFormat("en-GB", {
  dateStyle: "medium",
  timeZone: "UTC",
});

/**
 * MF-0058: a recorded completion date, in UTC so server and client print the same day. Labelled
 * " UTC" (as `formatUtcDate` does) because a learner far from UTC can otherwise read the wrong day.
 */
export function formatCompletedDate(iso: string): string {
  return `${COMPLETED_DATE.format(new Date(iso))} UTC`;
}

/** "Course n of N": the position of the Continue course (user, 2026-11-06); null once the path is complete. */
export function courseLine(
  progress: Pick<PathProgress, "nextPosition" | "total">,
): string | null {
  if (progress.nextPosition === null) return null;
  return `Course ${progress.nextPosition} of ${progress.total}`;
}

/** "{completed} of {N} complete", shown beside the course line and as the progress bar's label. */
export function completeLine(
  progress: Pick<PathProgress, "completedCount" | "total">,
): string {
  return `${progress.completedCount} of ${progress.total} complete`;
}

/** Continue goes to the next course's Walk. */
export function continueHref(packSlug: string): string {
  return `/play/${packSlug}/walk`;
}

/** MF-0062: a course row opens that course's map. */
export function courseMapHref(packSlug: string): string {
  return `/play/${packSlug}`;
}

/** The trophy line once every course is complete. A trophy, never a certification. */
export function trophyLine(completedAt: string | null): string {
  return completedAt
    ? `Path complete · ${formatCompletedDate(completedAt)}`
    : "Path complete";
}

/** "5 courses" / "1 course". */
export function courseCountLabel(total: number): string {
  return total === 1 ? "1 course" : `${total} courses`;
}
