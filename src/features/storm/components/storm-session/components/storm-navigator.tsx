import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { StormNavigatorProps } from "../types";

/** Jump to any question; each one says "Answered" or "Not answered" in words. */
export function StormNavigator({
  items,
  isLocked,
  onJump,
}: StormNavigatorProps) {
  return (
    <nav aria-label="Storm questions">
      <ol className="flex flex-wrap gap-2">
        {items.map((item, i) => (
          <li key={item.questionId}>
            <Button
              type="button"
              variant={item.isCurrent ? "secondary" : "outline"}
              className="h-auto min-h-10 gap-2 py-1.5"
              aria-current={item.isCurrent ? "step" : undefined}
              disabled={isLocked}
              onClick={() => onJump(i)}
            >
              <span className="font-semibold tabular-nums">{item.number}</span>
              <Badge
                variant={item.status === "Answered" ? "default" : "outline"}
              >
                {item.status}
              </Badge>
            </Button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
