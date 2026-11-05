"use client";

import { QuestionCard } from "@/components/question-card";
import { Badge } from "@/components/ui/badge";
import type { StormReviewProps } from "./types";
import { isMissVerdict, reviewVerdict } from "./utils";

// The review is read-only: every card is locked, so a toggle has nothing to change.
const ignoreToggle = (): void => {};

/** MF-0013: every storm question with the learner's answer, the key and every rationale. */
export function StormReview({ items, skillNames }: StormReviewProps) {
  return (
    <section aria-labelledby="storm-review" className="flex flex-col gap-4">
      <h2 id="storm-review" className="text-2xl font-semibold">
        Review every answer
      </h2>
      {items.map((item, i) => {
        const verdict = reviewVerdict(item);
        return (
          <QuestionCard
            key={item.question.id}
            question={item.question}
            chosen={item.chosen}
            feedback={item.feedback}
            isLocked
            onToggle={ignoreToggle}
            meta={
              <>
                <span className="tabular-nums">Question {i + 1}</span>
                <span aria-hidden>·</span>
                <span>
                  {skillNames[item.question.skillCode] ??
                    item.question.skillCode}
                </span>
                <Badge variant={isMissVerdict(verdict) ? "outline" : "default"}>
                  {verdict}
                </Badge>
                {item.unreviewed && (
                  <Badge variant="secondary">From the unreviewed pool</Badge>
                )}
              </>
            }
            footer={null}
          />
        );
      })}
    </section>
  );
}
