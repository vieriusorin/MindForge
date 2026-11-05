import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { SnippetLinesProps } from "../types";
import { isChoosable, type LineState, lineState } from "../utils";

const LINE_CLASS = {
  cuckoo: "border-primary bg-secondary",
  missed: "border-destructive",
  plain: "border-transparent",
} as const satisfies Record<LineState, string>;

/**
 * MF-0016 SC-6: the snippet, one radio per non-blank line. C-3: every line is a React text node
 * inside `<code>`, never HTML.
 */
export function SnippetLines({
  cuckooId,
  lines,
  chosenLine,
  feedback,
  isLocked,
  labelledBy,
  onChoose,
}: SnippetLinesProps) {
  return (
    <RadioGroup
      aria-labelledby={labelledBy}
      value={chosenLine === null ? "" : String(chosenLine)}
      onValueChange={(value) => onChoose(Number(value))}
      disabled={isLocked}
      className="gap-0 rounded-xl border bg-muted p-2 font-mono text-sm"
    >
      {lines.map((text, i) => {
        const line = i + 1;
        const state = lineState(line, chosenLine, feedback);
        const controlId = `line-${cuckooId}-${line}`;
        const textId = `${controlId}-text`;
        const number = (
          <span className="w-6 shrink-0 text-right text-muted-foreground tabular-nums">
            <span className="sr-only">Line </span>
            {line}
          </span>
        );
        const code = (
          <code
            id={textId}
            className="min-w-0 flex-1 break-words whitespace-pre-wrap"
          >
            {text}
          </code>
        );
        return (
          <div
            // Lines are positional: the index is the line's identity.
            key={line}
            className={`flex items-start gap-2 rounded-lg border px-2 py-1.5 ${LINE_CLASS[state]}`}
          >
            {isChoosable(text) ? (
              <>
                <RadioGroupItem
                  id={controlId}
                  value={String(line)}
                  // Named by its number, described by its text, so "Line 3" is read before the code.
                  aria-label={`Line ${line}`}
                  aria-describedby={textId}
                  className="mt-0.5"
                />
                <Label
                  htmlFor={controlId}
                  className="flex min-w-0 flex-1 cursor-pointer items-start gap-2 font-mono font-normal"
                >
                  {number}
                  {code}
                </Label>
              </>
            ) : (
              <>
                <span aria-hidden className="size-4 shrink-0" />
                {number}
                {code}
              </>
            )}
            {state === "cuckoo" && <Badge>Cuckoo</Badge>}
            {state === "missed" && <Badge variant="outline">Your pick</Badge>}
          </div>
        );
      })}
    </RadioGroup>
  );
}
