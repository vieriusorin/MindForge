import { QuestionCard } from "@/components/question-card";
import { Button } from "@/components/ui/button";
import type { GuessStepProps } from "../types";

/** D-L4: guess first. The pick stays in the browser: no attempt, no key. */
export function GuessStep({
  step,
  meta,
  chosen,
  canLock,
  onToggle,
  onLock,
  onSkip,
}: GuessStepProps) {
  return (
    <QuestionCard
      question={step.question}
      chosen={chosen}
      feedback={null}
      isLocked={false}
      onToggle={onToggle}
      meta={<span>{meta}</span>}
      footer={
        <>
          <p className="w-full text-sm text-muted-foreground">
            A guess before the lesson: it isn&apos;t graded or recorded. You
            will meet this question again later in the lesson.
          </p>
          <Button variant="ghost" onClick={onSkip} className="min-h-10">
            Skip
          </Button>
          <Button
            onClick={onLock}
            disabled={!canLock}
            className="ml-auto min-h-10"
          >
            Lock in guess
          </Button>
        </>
      }
    />
  );
}
