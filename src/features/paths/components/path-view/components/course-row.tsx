import { StageIcon } from "@/components/stage-icon";
import { Badge } from "@/components/ui/badge";
import { formatCompletedDate } from "@/features/paths/utils/path-display";
import type { CourseRowProps } from "../types";
import {
  fadingLabel,
  STATUS_BADGE,
  STATUS_LABEL,
  STATUS_STAGE,
  skillCountLabel,
  stageCountParts,
} from "../utils";

/** One course: place, tile, name, status word, skill count, recorded date, and live health. */
export function CourseRow({ course, showHealth }: CourseRowProps) {
  const fading = fadingLabel(course.wiltingSkills);
  return (
    <div className="flex items-start gap-3 py-4">
      <span className="w-5 shrink-0 pt-2.5 text-right text-sm text-muted-foreground tabular-nums">
        {course.position}
      </span>
      <StageIcon stage={STATUS_STAGE[course.status]} />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-semibold">{course.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
          <Badge variant={STATUS_BADGE[course.status]}>
            {STATUS_LABEL[course.status]}
          </Badge>
          <span className="tabular-nums">
            {skillCountLabel(course.skillCount)}
          </span>
          {course.completedAt && (
            <span className="tabular-nums">
              Complete · {formatCompletedDate(course.completedAt)}
            </span>
          )}
        </p>
        {showHealth && (
          <p className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground tabular-nums">
            <span className="sr-only">Live health:</span>
            {stageCountParts(course.stageCounts).map((part) => (
              <span key={part.stage}>{part.label}</span>
            ))}
            {fading && <span className="text-destructive">{fading}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
