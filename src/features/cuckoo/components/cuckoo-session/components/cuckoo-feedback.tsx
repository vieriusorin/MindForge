import { Badge } from "@/components/ui/badge";
import { CUCKOO_FLAW_KIND_LABEL } from "@/lib/cuckoo-labels";
import type { CuckooFeedbackProps } from "../types";

/** MF-0016 SC-6: why the flawed line is the cuckoo, shown only after the database graded the answer. */
export function CuckooFeedback({ feedback }: CuckooFeedbackProps) {
  return (
    <div className="flex w-full flex-col gap-2 rounded-xl border p-3 text-sm">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="secondary">
          {CUCKOO_FLAW_KIND_LABEL[feedback.flawKind]}
        </Badge>
        <span className="text-muted-foreground tabular-nums">
          on line {feedback.flawLine}
        </span>
      </div>
      <p>{feedback.explanation}</p>
    </div>
  );
}
