import { Badge } from "@/components/ui/badge";
import type { OrderFeedbackPanelProps } from "../types";

/** After grading: the verdict (announced and focused), then the key order and why. */
export function OrderFeedbackPanel({
  feedback,
  verdict,
  feedbackRef,
}: OrderFeedbackPanelProps) {
  return (
    <div className="flex flex-col gap-3">
      <output
        ref={feedbackRef}
        tabIndex={-1}
        aria-live="polite"
        className="font-semibold outline-none"
      >
        {verdict}
      </output>
      <ol aria-label="The order" className="flex flex-col gap-2">
        {feedback.steps.map((step, i) => (
          <li
            key={step.node}
            className="flex items-center gap-3 rounded-lg border bg-secondary px-3 py-2 text-secondary-foreground"
          >
            <Badge className="tabular-nums">{i + 1}</Badge>
            <span className="min-w-0 flex-1">{step.label}</span>
          </li>
        ))}
      </ol>
      <p className="text-sm">{feedback.explanation}</p>
    </div>
  );
}
