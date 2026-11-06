import { ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  completeLine,
  continueHref,
  courseLine,
  trophyLine,
} from "@/features/paths/utils/path-display";
import type { PathProgressSummaryProps } from "./types";

/**
 * MF-0058 SC-7/SC-8: "Course n of N", the bar and Continue, shared by the path page and the Today
 * card so both show the same figures from the same `pathProgress`.
 */
export function PathProgressSummary({ progress }: PathProgressSummaryProps) {
  const done = completeLine(progress);
  const course = courseLine(progress);
  if (progress.next === null || course === null) {
    return (
      <div className="flex flex-col gap-3">
        <p className="flex items-center gap-2 font-medium">
          <Trophy aria-hidden className="size-5 text-primary" />
          {trophyLine(progress.completedAt)}
        </p>
        <Progress value={progress.completedPercent} aria-label={done} />
        <p className="text-sm text-muted-foreground tabular-nums">{done}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium tabular-nums">{course}</p>
        <p className="text-sm text-muted-foreground tabular-nums">{done}</p>
      </div>
      <Progress value={progress.completedPercent} aria-label={done} />
      <div>
        <Button asChild>
          <Link href={continueHref(progress.next)}>
            Continue <ArrowRight aria-hidden data-icon="inline-end" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
