"use client";

import { CircleCheck, CircleX, ExternalLink, Sprout } from "lucide-react";
import Link from "next/link";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useDuelSession } from "./hooks/use-duel-session";
import type { DuelSessionProps } from "./types";

export function DuelSession({
  packSlug,
  questions,
  skillNames,
  backHref,
}: DuelSessionProps) {
  const s = useDuelSession(packSlug, questions);

  if (questions.length === 0) {
    return (
      <p className="text-muted-foreground">
        No questions are available for this pack yet.
      </p>
    );
  }

  if (s.finished || !s.question) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            Duel finished: <span className="tabular-nums">{s.score}</span> /{" "}
            <span className="tabular-nums">{s.answered}</span> correct
          </CardTitle>
          <CardDescription>
            Trees grow only from what you recalled correctly. Come back tomorrow
            to water the wilting ones.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={backHref}>Back to your forest</Link>
          </Button>
        </CardFooter>
      </Card>
    );
  }

  const q = s.question;
  const multi = q.select > 1;
  const optionState = (id: string): "key" | "missed" | "plain" => {
    if (!s.feedback) return "plain";
    if (s.feedback.correctOptionIds.includes(id)) return "key";
    return s.chosen.includes(id) ? "missed" : "plain";
  };

  const optionBody = (o: { id: string; text: string }) => {
    const state = optionState(o.id);
    return (
      <div
        key={o.id}
        data-key={s.feedback ? String(state === "key") : undefined}
        className={`rounded-xl border p-3 ${state === "key" ? "border-primary bg-secondary" : state === "missed" ? "border-destructive" : "border-border"}`}
      >
        <div className="flex items-start gap-3">
          {multi ? (
            <Checkbox
              id={`opt-${o.id}`}
              checked={s.chosen.includes(o.id)}
              disabled={Boolean(s.feedback)}
              onCheckedChange={() => s.toggle(o.id)}
              className="mt-0.5"
            />
          ) : (
            <RadioGroupItem
              id={`opt-${o.id}`}
              value={o.id}
              disabled={Boolean(s.feedback)}
              className="mt-0.5"
            />
          )}
          <Label
            htmlFor={`opt-${o.id}`}
            className="block cursor-pointer leading-snug font-normal"
          >
            <span className="font-semibold">{o.id}.</span> {o.text}
          </Label>
        </div>
        {s.feedback && (
          <p className="mt-2 flex gap-2 text-sm">
            {state === "key" ? (
              <CircleCheck
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-primary"
              />
            ) : (
              <CircleX
                aria-hidden
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              />
            )}
            <span>
              <span className="font-medium">
                {state === "key" ? "Correct. " : "Not this one. "}
              </span>
              {s.feedback.rationales[o.id]}
            </span>
          </p>
        )}
      </div>
    );
  };

  return (
    <Card aria-labelledby="duel-question">
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          <span className="tabular-nums">
            Question {s.index + 1} of {questions.length}
          </span>
          <span aria-hidden>·</span>
          <span>{skillNames[q.skillCode] ?? q.skillCode}</span>
          <Badge
            data-status={q.status}
            variant={q.status === "official" ? "default" : "secondary"}
          >
            {q.status === "official" ? "Official sample" : "Unreviewed"}
          </Badge>
        </div>
        <CardTitle
          id="duel-question"
          className="text-lg leading-snug font-medium"
        >
          {q.stem}
        </CardTitle>
        {multi && <CardDescription>Select {q.select}.</CardDescription>}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        {multi ? (
          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">Options</legend>
            {q.options.map(optionBody)}
          </fieldset>
        ) : (
          <RadioGroup
            aria-label="Options"
            value={s.chosen[0] ?? ""}
            onValueChange={(v) => s.toggle(v)}
            className="flex flex-col gap-2"
          >
            {q.options.map(optionBody)}
          </RadioGroup>
        )}
        {s.error && (
          <p role="alert" className="text-sm text-destructive">
            {s.error}
          </p>
        )}
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        {s.feedback ? (
          <>
            <output className="flex items-center gap-2 font-semibold">
              {s.feedback.correct ? (
                <>
                  <Sprout aria-hidden className="size-4 text-primary" />{" "}
                  Correct! Recalled and recorded.
                </>
              ) : (
                <>
                  <CircleX aria-hidden className="size-4 text-destructive" />{" "}
                  Not quite. Read why, then try it again another day.
                </>
              )}
            </output>
            <Button variant="link" asChild className="px-0">
              <a href={q.source.url} target="_blank" rel="noreferrer">
                Source: {q.source.title}{" "}
                <ExternalLink aria-hidden className="size-3" />
              </a>
            </Button>
            <Button onClick={s.next} className="ml-auto">
              {s.index + 1 < questions.length ? "Next question" : "Finish"}
            </Button>
          </>
        ) : (
          <Button
            onClick={s.submit}
            disabled={!s.canSubmit}
            className="ml-auto"
          >
            {s.isPending ? "Checking…" : "Check answer"}
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
