import { ConfidenceTap } from "@/components/confidence-tap";
import { QuestionCard } from "@/components/question-card";
import { Button } from "@/components/ui/button";
import type { QuestionStepProps } from "../types";
import { WhyPanel } from "./why-panel";

/** A graded step (recall, confusable, re-ask): the verdict, then Why? on demand. */
export function QuestionStep({
  step,
  meta,
  chosen,
  feedback,
  announcement,
  guessNote,
  error,
  isPending,
  canSubmit,
  isLast,
  feedbackRef,
  onToggle,
  confidence,
  onChooseConfidence,
  onSubmit,
  onNext,
}: QuestionStepProps) {
  return (
    <QuestionCard
      question={step.question}
      chosen={chosen}
      feedback={feedback}
      isLocked={feedback !== null || isPending}
      onToggle={onToggle}
      showRationales={false}
      meta={<span>{meta}</span>}
      footer={
        <>
          <output
            ref={feedbackRef}
            tabIndex={-1}
            aria-live="polite"
            className="flex w-full items-center gap-2 font-semibold"
          >
            {announcement}
          </output>
          {guessNote && (
            <p className="w-full text-sm text-muted-foreground">{guessNote}</p>
          )}
          {error && (
            <p role="alert" className="w-full text-sm text-destructive">
              {error}
            </p>
          )}
          {feedback && <WhyPanel step={step} feedback={feedback} />}
          <ConfidenceTap
            value={confidence}
            isLocked={feedback !== null || isPending}
            onChoose={onChooseConfidence}
          />
          {feedback ? (
            <Button onClick={onNext} className="ml-auto min-h-10">
              {isLast ? "Finish lesson" : "Next"}
            </Button>
          ) : (
            <Button
              onClick={onSubmit}
              disabled={!canSubmit}
              className="ml-auto min-h-10"
            >
              {isPending ? "Checking…" : "Check answer"}
            </Button>
          )}
        </>
      }
    />
  );
}
