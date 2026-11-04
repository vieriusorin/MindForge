"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { QuestionCard } from "@/components/question-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { FinishStormDialog } from "./components/finish-storm-dialog";
import { StormCountdown } from "./components/storm-countdown";
import { StormNavigator } from "./components/storm-navigator";
import { useStormSession } from "./hooks/use-storm-session";
import type { StormSessionProps } from "./types";

/** MF-0013: a running storm. Answers are stored, never graded, until the storm finishes. */
export function StormSession({
  stormId,
  endsAt,
  questions,
  skillNames,
}: StormSessionProps) {
  const s = useStormSession({ stormId, endsAt, questions });
  const { question } = s.current;

  return (
    <div className="flex flex-col gap-6">
      <Card size="sm">
        <CardContent className="flex flex-wrap items-center justify-between gap-4">
          <StormCountdown
            label={s.countdownLabel}
            announcement={s.announcement}
          />
          <FinishStormDialog
            warning={s.finishWarning}
            isFinishing={s.isFinishing}
            isLocked={s.isLocked}
            onConfirm={s.finish}
          />
        </CardContent>
      </Card>

      <QuestionCard
        // A fresh card per question resets Radix's roving tab stop to the first option.
        key={question.id}
        question={question}
        chosen={s.chosen}
        feedback={null}
        isLocked={s.isLocked}
        onToggle={s.toggle}
        headingRef={s.headingRef}
        meta={
          <>
            <span className="tabular-nums">{s.positionLabel}</span>
            <span aria-hidden>·</span>
            <span>{skillNames[question.skillCode] ?? question.skillCode}</span>
          </>
        }
        footer={
          <>
            {s.error && (
              <p role="alert" className="w-full text-sm text-destructive">
                {s.error}
              </p>
            )}
            <p aria-live="polite" className="text-sm text-muted-foreground">
              {s.isSaving ? "Saving…" : ""}
            </p>
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={s.previous}
                disabled={s.isFirst || s.isLocked}
              >
                <ChevronLeft aria-hidden />
                Previous
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={s.next}
                disabled={s.isLast || s.isLocked}
              >
                Next
                <ChevronRight aria-hidden />
              </Button>
            </div>
          </>
        }
      />

      <StormNavigator
        items={s.navigator}
        isLocked={s.isLocked}
        onJump={s.goTo}
      />
    </div>
  );
}
