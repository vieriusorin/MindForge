import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { StageIcon } from "@/components/stage-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ReviewLine } from "./components/review-line";
import type { LessonCloseProps } from "./types";
import { changeLine, reviewLine, scoreLine } from "./utils";

/** MF-0064: the close screen: each skill's real tree before and after, and its next review date. */
export function LessonClose({ outcome, mapHref }: LessonCloseProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h2>Lesson complete</h2>
        </CardTitle>
        <CardDescription>
          Your forest, replayed from the answers you just gave.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul>
          {outcome.skills.map((skill, i) => (
            <li key={skill.skillCode}>
              {i > 0 && <Separator />}
              <div className="flex items-center gap-3 py-3">
                <StageIcon stage={skill.before.stage} size="sm" />
                <ArrowRight
                  aria-hidden
                  className="size-4 shrink-0 text-muted-foreground"
                />
                <StageIcon stage={skill.after.stage} size="sm" />
                <div className="grid min-w-0 flex-1 gap-1">
                  <p className="font-semibold leading-snug">{skill.name}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-sm">
                    <Badge variant="secondary">{changeLine(skill)}</Badge>
                    {skill.after.wilting && (
                      <Badge variant="destructive">Fading</Badge>
                    )}
                    <span className="text-muted-foreground tabular-nums">
                      {scoreLine(skill)}
                    </span>
                  </p>
                  <ReviewLine line={reviewLine(skill)} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      </CardContent>
      <CardFooter>
        <Button asChild className="min-h-10">
          <Link href={mapHref}>Back to course map</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
