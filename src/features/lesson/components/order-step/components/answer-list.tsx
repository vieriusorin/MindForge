import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { AnswerListProps } from "../types";

/** The learner's order so far, numbered, each step removable until it is checked. */
export function AnswerList({ answer, isLocked, onRemove }: AnswerListProps) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">Your order</h3>
      {answer.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Add the first step from the list.
        </p>
      )}
      <ol aria-label="Your order" className="flex flex-col gap-2">
        {answer.map((step, i) => (
          <li
            key={step.id}
            className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2"
          >
            <Badge variant="secondary" className="tabular-nums">
              {i + 1}
            </Badge>
            <span className="min-w-0 flex-1">{step.label}</span>
            {!isLocked && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove: ${step.label}`}
                onClick={() => onRemove(step.id)}
                className="size-10"
              >
                <X aria-hidden />
              </Button>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
