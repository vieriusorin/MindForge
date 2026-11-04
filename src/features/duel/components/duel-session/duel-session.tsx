"use client";

import { ExternalLink, Sprout } from "lucide-react";
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
import { useDuelSession } from "./hooks/use-duel-session";
import type { DuelSessionProps } from "./types";

/** MF-0003 / MF-0012: the Scenario Duel, one question at a time on the shared card, graded by the database. */
export function DuelSession({
  packSlug,
  questions,
  skillNames,
  back,
}: DuelSessionProps) {
  const s = useDuelSession(packSlug, questions);

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground">
        No questions are available for this pack yet.
      </p>
    );
  }

  if (s.isFinished || !s.question) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2 ref={s.doneRef} tabIndex={-1}>
              Duel finished: <span className="tabular-nums">{s.score}</span> /{" "}
              <span className="tabular-nums">{s.answered}</span> correct
            </h2>
          </CardTitle>
          <CardDescription>
            Trees grow only from what you recalled correctly. Come back tomorrow
            to water the wilting ones.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={back.href}>{back.label}</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const q = s.question;

  return (
    <QuestionCard
      // A fresh card per question resets Radix's roving tab stop to the first option.
      key={q.id}
      question={q}
      chosen={s.chosen}
      feedback={s.feedback}
      isLocked={s.feedback !== null || s.isPending}
      onToggle={s.toggle}
      headingRef={s.headingRef}
      meta={
        <>
          <span className="tabular-nums">
            Question {s.index + 1} of {questions.length}
          </span>
          <span aria-hidden>·</span>
          <span>{skillNames[q.skillCode] ?? q.skillCode}</span>
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
          {s.feedback && (
            <Button variant="link" asChild className="px-0">
              <a href={q.source.url} target="_blank" rel="noreferrer">
                Source: {q.source.title}{" "}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </Button>
          )}
          {s.feedback ? (
            <Button onClick={s.next} className="ml-auto">
              {s.isLast ? "Finish" : "Next question"}
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
