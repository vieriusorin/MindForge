"use client";

import type { ReactNode } from "react";
import { EmptyLesson } from "./components/empty-lesson";
import { GuessStep } from "./components/guess-step";
import { ProgressBar } from "./components/progress-bar";
import { QuestionStep } from "./components/question-step";
import { TeachStep } from "./components/teach-step";
import { useLessonPlayer } from "./hooks/use-lesson-player";
import type { LessonPlayerProps } from "./types";
import { stepMeta } from "./utils";

/** MF-0064: one skill's lesson, step by step, with a segmented progress bar. */
export function LessonPlayer({
  packSlug,
  skillCode,
  steps,
  startedAt,
  card,
  diagram,
  mapHref,
}: LessonPlayerProps) {
  const p = useLessonPlayer({ packSlug, skillCode, steps, startedAt });
  if (!p.step) return <EmptyLesson mapHref={mapHref} />;

  const step = p.step;
  const meta = stepMeta(step);
  let body: ReactNode;
  // MF-0066: a new step kind is one more case here; the `never` default refuses to compile without it.
  switch (step.kind) {
    case "card":
      body = <TeachStep meta={meta} slot={card} onContinue={p.next} />;
      break;
    case "diagram":
      body = <TeachStep meta={meta} slot={diagram} onContinue={p.next} />;
      break;
    case "guess":
      body = (
        <GuessStep
          step={step}
          meta={meta}
          chosen={p.chosen}
          canLock={p.canSubmit}
          onToggle={p.toggle}
          onLock={p.lockGuess}
          onSkip={p.skipGuess}
        />
      );
      break;
    case "recall":
    case "confusable":
    case "reask":
      body = (
        <QuestionStep
          step={step}
          meta={meta}
          chosen={p.chosen}
          feedback={p.feedback}
          announcement={p.announcement}
          guessNote={p.guessNote}
          error={p.error}
          isPending={p.isPending}
          canSubmit={p.canSubmit}
          isLast={p.isLast}
          feedbackRef={p.feedbackRef}
          onToggle={p.toggle}
          onSubmit={p.submit}
          onNext={p.next}
        />
      );
      break;
    default: {
      const unknownStep: never = step;
      body = unknownStep;
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <ProgressBar progress={p.progress} />
      <section
        key={p.index}
        ref={p.stepRef}
        tabIndex={-1}
        aria-label={meta}
        className="outline-none"
      >
        {body}
      </section>
    </div>
  );
}
