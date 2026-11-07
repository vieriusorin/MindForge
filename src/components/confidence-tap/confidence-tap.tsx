import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Confidence } from "@/engine/memory";
import type { ConfidenceTapProps } from "./types";

const LABEL = {
  sure: "Sure",
  unsure: "Not sure",
} as const satisfies Record<Confidence, string>;

const ORDER = ["sure", "unsure"] as const satisfies readonly Confidence[];

/**
 * MF-0065 (ADR 0007): the optional tap before the reveal. Sure + correct grows a tree faster than Not sure +
 * correct; Sure + wrong brings the skill back within a day. Two toggle buttons; the pressed one again clears.
 * The pressed one is filled and carries a check mark, so its state never rests on colour alone (ui-design §5).
 */
export function ConfidenceTap({
  value,
  isLocked,
  onChoose,
}: ConfidenceTapProps) {
  return (
    <fieldset
      aria-label="How sure are you?"
      className="m-0 flex min-w-0 flex-wrap items-center gap-2 border-0 p-0"
    >
      <span aria-hidden className="text-sm text-muted-foreground">
        How sure are you?
      </span>
      {ORDER.map((confidence) => {
        const isPressed = value === confidence;
        return (
          <Button
            key={confidence}
            type="button"
            size="sm"
            variant={isPressed ? "default" : "outline"}
            aria-pressed={isPressed}
            disabled={isLocked}
            onClick={() => onChoose(confidence)}
            className="min-h-10"
          >
            {isPressed && <Check aria-hidden className="size-4" />}
            {LABEL[confidence]}
          </Button>
        );
      })}
    </fieldset>
  );
}
