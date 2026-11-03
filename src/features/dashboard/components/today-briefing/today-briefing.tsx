import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatWeight } from "@/lib/forest-display";
import type { TodayBriefingProps } from "./types";

const TILE = "gap-1 bg-white/10 text-white shadow-none ring-white/15";

/** The reference's briefing banner: a shadcn Card on the hero gradient with glassy sub-cards. */
export function TodayBriefing({
  grownSkills,
  totalSkills,
  grownPercent,
  topFocus,
  exam,
  groupCount,
}: TodayBriefingProps) {
  return (
    <Card className="bg-hero gap-5 py-6 ring-0">
      <CardHeader className="px-6">
        <CardDescription className="text-xs font-medium tracking-wider text-white/70 uppercase">
          Today&apos;s briefing
        </CardDescription>
        <CardTitle className="text-2xl leading-snug font-normal text-white">
          <span className="font-semibold">
            {grownSkills} of {totalSkills} skills growing.
          </span>{" "}
          <span className="text-white/75">
            {grownSkills === 0
              ? "Your forest is all seeds, ready to plant."
              : `${grownPercent}% of the exam weight is taking root.`}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-3 px-6 sm:grid-cols-3">
        {topFocus && (
          <Card size="sm" className={TILE}>
            <CardHeader>
              <CardDescription className="text-white/70">
                Top focus
              </CardDescription>
              <CardTitle className="truncate">{topFocus.name}</CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/75">
              {formatWeight(topFocus.weight)} of the exam
            </CardContent>
          </Card>
        )}
        {exam && (
          <Card size="sm" className={TILE}>
            <CardHeader>
              <CardDescription className="text-white/70">
                Exam format
              </CardDescription>
              <CardTitle>
                {exam.questions} questions · {exam.minutes} min
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/75">
              Pass at {exam.passScaled} of {exam.scaleMax}
            </CardContent>
          </Card>
        )}
        <Link href="/groups" className="rounded-xl">
          <Card
            size="sm"
            className={`${TILE} h-full transition-colors hover:bg-white/15`}
          >
            <CardHeader>
              <CardDescription className="text-white/70">
                Study groups
              </CardDescription>
              <CardTitle>
                {groupCount === 0
                  ? "No group yet"
                  : `${groupCount} group${groupCount === 1 ? "" : "s"}`}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-xs text-white/75">
              {groupCount === 0
                ? "Start one with colleagues"
                : "Open your groups"}
            </CardContent>
          </Card>
        </Link>
      </CardContent>
    </Card>
  );
}
