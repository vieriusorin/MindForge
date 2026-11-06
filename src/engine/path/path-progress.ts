import type { ForestView } from "../forest/build-forest";
import type {
  CourseCompletion,
  CourseProgress,
  PathContent,
  PathProgress,
} from "./types";

export interface PathProgressInput {
  path: PathContent;
  completions: readonly CourseCompletion[];
  /** The learner's forest per pack slug. */
  forests: ReadonlyMap<string, ForestView>;
}

function courseProgress(
  packSlug: string,
  completion: CourseCompletion | undefined,
  forest: ForestView | undefined,
): CourseProgress {
  // A recorded completion stays complete whatever the live forest shows ("recorded once").
  if (completion) {
    return {
      packSlug,
      status: "complete",
      completedAt: completion.completedAt,
    };
  }
  const isStarted =
    forest?.regions.some((region) =>
      region.trees.some((tree) => tree.stage !== "seed"),
    ) ?? false;
  return { packSlug, status: isStarted ? "in-progress" : "not-started" };
}

function latest(dates: readonly string[]): string | null {
  let best: string | null = null;
  for (const date of dates) {
    if (best === null || Date.parse(date) > Date.parse(best)) best = date;
  }
  return best;
}

/**
 * MF-0058: per-course status in path order, the counts, and the Continue target. Completions for
 * packs outside the path are ignored; a course missing from `forests` is not started.
 */
export function pathProgress(input: PathProgressInput): PathProgress {
  const { path, completions, forests } = input;
  const bySlug = new Map(completions.map((c) => [c.packSlug, c]));
  const courses = path.courses.map((slug) =>
    courseProgress(slug, bySlug.get(slug), forests.get(slug)),
  );
  const completedDates = courses.flatMap((c) =>
    c.status === "complete" ? [c.completedAt] : [],
  );
  const completedCount = completedDates.length;
  const total = courses.length;
  const nextIndex = courses.findIndex((c) => c.status !== "complete");
  const isPathComplete = completedCount === total;
  return {
    courses,
    completedCount,
    total,
    next: courses[nextIndex]?.packSlug ?? null,
    nextPosition: nextIndex === -1 ? null : nextIndex + 1,
    completedPercent:
      total === 0 ? 0 : Math.round((100 * completedCount) / total),
    isPathComplete,
    completedAt: isPathComplete ? latest(completedDates) : null,
  };
}
