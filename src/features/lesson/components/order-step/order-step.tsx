"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { AnswerList } from "./components/answer-list";
import { OrderFeedbackPanel } from "./components/order-feedback-panel";
import { StepPool } from "./components/step-pool";
import { useOrderStep } from "./hooks/use-order-step";
import type { OrderStepProps } from "./types";

/** MF-0066 SC-7: put the steps of one process in order, then check it against the database. */
export function OrderStep({
  step,
  meta,
  packSlug,
  isLast,
  onNext,
}: OrderStepProps) {
  const o = useOrderStep({ step, packSlug });
  return (
    <Card ref={o.containerRef}>
      <CardHeader>
        <CardDescription className="text-xs font-medium tracking-wider uppercase">
          {meta}
        </CardDescription>
        <CardTitle>
          <h2 className="text-lg leading-snug">{step.order.title}</h2>
        </CardTitle>
      </CardHeader>
      <CardContent className="grid gap-6 md:grid-cols-2">
        {o.feedback ? (
          <OrderFeedbackPanel
            feedback={o.feedback}
            verdict={o.verdict}
            feedbackRef={o.feedbackRef}
          />
        ) : (
          <StepPool pool={o.pool} isLocked={o.isLocked} onAdd={o.add} />
        )}
        <AnswerList
          answer={o.answer}
          isLocked={o.isLocked}
          onRemove={o.remove}
        />
        <p aria-live="polite" className="sr-only">
          {o.moveLine}
        </p>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        {o.error && (
          <p role="alert" className="w-full text-sm text-destructive">
            {o.error}
          </p>
        )}
        {o.feedback ? (
          <Button onClick={onNext} className="ml-auto min-h-10">
            {isLast ? "Finish" : "Continue"}
          </Button>
        ) : (
          <Button
            onClick={o.check}
            disabled={!o.canCheck}
            data-focus-key="check"
            aria-busy={o.isPending}
            className="ml-auto min-h-10"
          >
            Check order
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
