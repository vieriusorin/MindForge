import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { StepPoolProps } from "../types";

/** The steps still to place, each one button. */
export function StepPool({ pool, isLocked, onAdd }: StepPoolProps) {
  if (pool.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-medium text-muted-foreground">
        Steps to place
      </h3>
      <ul aria-label="Steps to place" className="flex flex-col gap-2">
        {pool.map((step) => (
          <li key={step.id}>
            <Button
              type="button"
              variant="outline"
              aria-label={`Add: ${step.label}`}
              data-focus-key={`add:${step.id}`}
              disabled={isLocked}
              onClick={() => onAdd(step.id)}
              className="h-auto min-h-10 w-full justify-start text-left whitespace-normal"
            >
              <Plus aria-hidden />
              {step.label}
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
