import type {
  MoveDisabledReason,
  PathCardView,
  PathCardViewInput,
} from "./types";

const NOT_IN_PATH: MoveDisabledReason =
  "This group's course isn't in the path any more";
const LAST_COURSE: MoveDisabledReason = "Last course of the path";

/**
 * MF-0059 SC-7: what the group's Path card shows. The position comes from `groupCourseStep`; with
 * no step (C-3) nothing is marked current and the move is refused with the reason.
 */
export function pathCardView({
  path,
  step,
  packNames,
}: PathCardViewInput): PathCardView {
  const nameOf = (slug: string): string => packNames[slug] ?? slug;
  const rows = path.courses.map((slug, index) => ({
    slug,
    name: nameOf(slug),
    isCurrent: step !== null && index === step.position - 1,
  }));
  const base = { title: `${path.name} path`, rows };
  if (step === null)
    return {
      ...base,
      positionLine: NOT_IN_PATH,
      nextCourseName: null,
      moveDisabledReason: NOT_IN_PATH,
    };
  return {
    ...base,
    positionLine: `Course ${step.position} of ${step.total}`,
    nextCourseName: step.next === null ? null : nameOf(step.next),
    moveDisabledReason: step.next === null ? LAST_COURSE : null,
  };
}
