"use client";

import { Sprout } from "lucide-react";
import Link from "next/link";
import { ConfidenceTap } from "@/components/confidence-tap";
import { QuestionCard } from "@/components/question-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useWalkSession } from "./hooks/use-walk-session";
import type { WalkSessionProps } from "./types";
import { reasonLabel } from "./utils";

/** MF-0009: the Daily Walk, one question at a time, graded by the database. */
export function WalkSession({
  packSlug,
  steps,
  skillNames,
  todayHref,
  duelHref,
  newSeedPrimer,
}: WalkSessionProps) {
  const s = useWalkSession(packSlug, steps);

  if (steps.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2>Your forest is healthy today</h2>
          </CardTitle>
          <CardDescription>
            No tree needs water and every skill has been planted. Sharpen
            yourself in a Duel instead.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={duelHref}>Play a Duel</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (s.isFinished || !s.step) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2 ref={s.doneRef} tabIndex={-1}>
              Today&apos;s walk is done
            </h2>
          </CardTitle>
          <CardDescription>
            Every answer is recorded. Trees grow only from what you recalled
            correctly; your forest shows where they stand now.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={todayHref}>Back to your forest</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const { question, reason } = s.step;

  const card = (
    <QuestionCard
      // A fresh card per question resets Radix's roving tab stop to the first option.
      key={question.id}
      question={question}
      chosen={s.chosen}
      feedback={s.feedback}
      isLocked={s.feedback !== null || s.isPending}
      onToggle={s.toggle}
      headingRef={s.headingRef}
      meta={
        <>
          <span className="tabular-nums">
            Question {s.index + 1} of {steps.length}
          </span>
          <span aria-hidden>·</span>
          <span>{skillNames[question.skillCode] ?? question.skillCode}</span>
          <Badge variant="outline">{reasonLabel(reason)}</Badge>
        </>
      }
      footer={
        <>
          <output
            ref={s.feedbackRef}
            tabIndex={-1}
            aria-live="polite"
            className="flex items-center gap-2 font-semibold"
          >
            {s.announcement}
          </output>
          {s.feedback?.correct && (
            <Sprout aria-hidden className="size-4 text-primary" />
          )}
          {s.error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {s.error}
            </p>
          )}
          <ConfidenceTap
            value={s.confidence}
            isLocked={s.feedback !== null || s.isPending}
            onChoose={s.chooseConfidence}
          />
          {s.feedback ? (
            <Button onClick={s.next} className="ml-auto">
              {s.isLast ? "Finish the walk" : "Next question"}
            </Button>
          ) : (
            <Button
              onClick={s.submit}
              disabled={!s.canSubmit}
              className="ml-auto"
            >
              {s.isPending ? "Checking…" : "Check answer"}
            </Button>
          )}
        </>
      }
    />
  );

  if (reason !== "new" || !newSeedPrimer) return card;
  return (
    <div className="flex flex-col gap-6">
      {newSeedPrimer}
      {card}
    </div>
  );
}
