import { Progress } from "@/components/ui/progress";
import type { ProgressBarProps } from "../types";
import { SEGMENT_VALUE, stepCountLine } from "../utils";

/** D-L13: one segment per step (decorative) plus the count in words. */
export function ProgressBar({ progress }: ProgressBarProps) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm font-medium text-muted-foreground tabular-nums">
        {stepCountLine(progress.position, progress.total)}
      </p>
      <div aria-hidden className="flex gap-1">
        {progress.segments.map((segment, i) => (
          <Progress
            // Segments are positional: the i-th step of this lesson.
            // biome-ignore lint/suspicious/noArrayIndexKey: positional segments
            key={i}
            value={SEGMENT_VALUE[segment]}
            className="h-1.5 flex-1"
          />
        ))}
      </div>
    </div>
  );
}
