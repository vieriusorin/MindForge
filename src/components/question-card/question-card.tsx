import { CircleCheck, CircleX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { OptionState, QuestionCardProps } from "./types";
import { optionState, originBadge } from "./utils";

const OPTION_CLASS = {
  key: "border-primary bg-secondary",
  missed: "border-destructive",
  plain: "border-border",
} as const satisfies Record<OptionState, string>;

const OPTION_VERDICT = {
  key: "Correct. ",
  missed: "Not this one. ",
  plain: "Not this one. ",
} as const satisfies Record<OptionState, string>;

/** MF-0009: one question, its options and, once graded, every option's rationale. Shared by practice modes. */
export function QuestionCard({
  question,
  meta,
  chosen,
  feedback,
  isLocked,
  onToggle,
  headingRef,
  footer,
  showRationales = true,
}: QuestionCardProps) {
  const isMulti = question.select > 1;
  const headingId = `question-${question.id}`;
  const badge = originBadge(question.origin);

  const options = question.options.map((o) => {
    const state = optionState(o.id, chosen, feedback);
    const controlId = `opt-${question.id}-${o.id}`;
    return (
      <div
        key={o.id}
        data-key={feedback ? String(state === "key") : undefined}
        className={`rounded-xl border p-3 ${OPTION_CLASS[state]}`}
      >
        <div className="flex items-start gap-3">
          {isMulti ? (
            <Checkbox
              id={controlId}
              checked={chosen.includes(o.id)}
              disabled={isLocked}
              onCheckedChange={() => onToggle(o.id)}
              className="mt-0.5"
            />
          ) : (
            <RadioGroupItem
              id={controlId}
              value={o.id}
              disabled={isLocked}
              className="mt-0.5"
            />
          )}
          <Label
            htmlFor={controlId}
            className="block cursor-pointer leading-snug font-normal"
          >
            <span className="font-semibold">{o.id}.</span> {o.text}
          </Label>
        </div>
        {feedback && (
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
              <span className="font-medium">{OPTION_VERDICT[state]}</span>
              {showRationales && feedback.rationales[o.id]}
            </span>
          </p>
        )}
      </div>
    );
  });

  return (
    // MF-0012: a generic div cannot be named; as a group it takes the stem as its name.
    <Card role="group" aria-labelledby={headingId}>
      <CardHeader>
        <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
          {meta}
          <Badge
            data-origin={question.origin}
            variant={badge.isOfficial ? "default" : "secondary"}
          >
            {badge.label}
          </Badge>
        </div>
        <CardTitle className="text-lg leading-snug font-medium">
          <h2 id={headingId} ref={headingRef} tabIndex={-1}>
            {question.stem}
          </h2>
        </CardTitle>
        {isMulti && (
          <CardDescription>Select {question.select}.</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <FieldSet className="gap-2">
          <FieldLegend className="sr-only">Options</FieldLegend>
          {isMulti ? (
            <div className="flex flex-col gap-2">{options}</div>
          ) : (
            <RadioGroup
              aria-label="Options"
              value={chosen[0] ?? ""}
              onValueChange={onToggle}
              className="flex flex-col gap-2"
            >
              {options}
            </RadioGroup>
          )}
        </FieldSet>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-3">
        {footer}
      </CardFooter>
    </Card>
  );
}
