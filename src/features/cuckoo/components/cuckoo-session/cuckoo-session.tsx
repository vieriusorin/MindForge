"use client";

import { Sprout } from "lucide-react";
import Link from "next/link";
import { originBadge } from "@/components/question-card";
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
import { CUCKOO_SNIPPET_KIND_LABEL } from "@/lib/cuckoo-labels";
import { CuckooFeedback } from "./components/cuckoo-feedback";
import { RoundFinished } from "./components/round-finished";
import { SnippetLines } from "./components/snippet-lines";
import { useCuckooSession } from "./hooks/use-cuckoo-session";
import type { CuckooSessionProps } from "./types";
import { nextLabel } from "./utils";

/** MF-0016: Spot the Cuckoo, one snippet at a time, graded by the database. */
export function CuckooSession({
  packSlug,
  cuckoos,
  skillNames,
  back,
}: CuckooSessionProps) {
  const s = useCuckooSession(packSlug, cuckoos);

  if (cuckoos.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2>No cuckoos to spot in this pack yet</h2>
          </CardTitle>
          <CardDescription>
            Snippets appear here once they are written and not withdrawn for
            review.
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

  if (s.isFinished || !s.cuckoo) {
    return (
      <RoundFinished
        score={s.score}
        answered={s.answered}
        back={back}
        doneRef={s.doneRef}
      />
    );
  }

  const c = s.cuckoo;
  const headingId = `cuckoo-${c.id}`;
  const badge = originBadge(c.origin);

  return (
    <Card role="group" aria-labelledby={headingId}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Snippet {s.index + 1} of {cuckoos.length}
          </span>
          <span aria-hidden>·</span>
          <span>{skillNames[c.skillCode] ?? c.skillCode}</span>
          <span aria-hidden>·</span>
          <span>{CUCKOO_SNIPPET_KIND_LABEL[c.snippetKind]}</span>
          <Badge
            data-origin={c.origin}
            variant={badge.isOfficial ? "default" : "secondary"}
          >
            {badge.label}
          </Badge>
        </div>
        <CardTitle className="text-lg leading-snug font-medium">
          <h2 id={headingId} ref={s.headingRef} tabIndex={-1}>
            {c.title}
          </h2>
        </CardTitle>
        <CardDescription>
          One line holds a planted flaw. Pick it.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SnippetLines
          // A fresh group per snippet resets Radix's roving tab stop to the first line.
          key={c.id}
          cuckooId={c.id}
          lines={c.lines}
          chosenLine={s.chosenLine}
          feedback={s.feedback}
          isLocked={s.feedback !== null || s.isPending}
          labelledBy={headingId}
          onChoose={s.choose}
        />
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
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
        {s.feedback && <CuckooFeedback feedback={s.feedback} />}
        {s.feedback || s.isRefused ? (
          <Button onClick={s.next} className="ml-auto">
            {nextLabel({ isRefused: s.isRefused, isLast: s.isLast })}
          </Button>
        ) : (
          <Button onClick={s.submit} disabled={!s.canCheck} className="ml-auto">
            {s.isPending ? "Checking…" : "Check answer"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
