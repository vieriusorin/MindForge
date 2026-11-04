"use client";

import { Sprout } from "lucide-react";
import Link from "next/link";
import { QuestionCard } from "@/components/question-card";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useSeedChecks } from "./hooks/use-seed-checks";
import type { SeedChecksProps } from "./types";
import { outcomeCopy } from "./utils";

/** MF-0010: the quick checks after the card and diagram, graded by the database. */
export function SeedChecks({
  packSlug,
  checks,
  wasSeed,
  forestHref,
}: SeedChecksProps) {
  const s = useSeedChecks({ packSlug, checks, wasSeed });

  if (checks.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2>No quick checks yet</h2>
          </CardTitle>
          <CardDescription>
            This skill has no questions to check yourself with yet, so it
            can&apos;t sprout today.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild variant="outline">
            <Link href={forestHref}>Back to Today</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  if (s.outcome || !s.check) {
    const copy = outcomeCopy(s.outcome ?? "recorded");
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            {s.outcome === "sprouted" && (
              <Sprout aria-hidden className="size-5 text-primary" />
            )}
            <h2 ref={s.doneRef} tabIndex={-1}>
              {copy.title}
            </h2>
          </CardTitle>
          <CardDescription>{copy.description}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={forestHref}>Back to Today</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  return (
    <QuestionCard
      key={s.check.id}
      question={s.check}
      chosen={s.chosen}
      feedback={s.feedback}
      isLocked={s.feedback !== null || s.isPending}
      onToggle={s.toggle}
      headingRef={s.headingRef}
      meta={
        <span className="tabular-nums">
          Quick check {s.index + 1} of {checks.length}
        </span>
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
          {s.error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {s.error}
            </p>
          )}
          {s.feedback ? (
            <Button onClick={s.next} className="ml-auto">
              {s.isLast ? "Finish planting" : "Next check"}
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
}
