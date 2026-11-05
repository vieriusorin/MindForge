"use client";

import { CircleAlert, CloudLightning } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useStormStart } from "./hooks/use-storm-start";
import type { StormStartProps } from "./types";
import { formatMinutes } from "./utils";

/** MF-0013: the rules of a storm and its Start button. */
export function StormStart({
  packSlug,
  kind,
  domainCode,
  questionCount,
  durationSeconds,
}: StormStartProps) {
  const s = useStormStart({ packSlug, kind, domainCode });
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h2 className="tabular-nums">
            Up to {questionCount} questions in {formatMinutes(durationSeconds)}
          </h2>
        </CardTitle>
        <CardDescription>
          If fewer questions are ready, the storm is shorter and the clock
          shrinks with it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="list-disc space-y-1 pl-5 text-sm">
          <li>No feedback until the end: you see your score after Finish.</li>
          <li>You can skip questions, come back and change answers.</li>
          <li>
            The clock keeps running if you close the tab. When it reaches zero
            the storm ends and unanswered questions count as wrong.
          </li>
        </ul>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        {s.error && (
          <Alert variant="destructive" className="w-full">
            <CircleAlert aria-hidden />
            <AlertDescription>{s.error}</AlertDescription>
          </Alert>
        )}
        <Button onClick={s.start} disabled={s.isStarting}>
          <CloudLightning aria-hidden />
          {s.isStarting ? "Starting…" : "Start the storm"}
        </Button>
      </CardFooter>
    </Card>
  );
}
