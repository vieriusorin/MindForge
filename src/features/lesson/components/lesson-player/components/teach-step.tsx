import { Button } from "@/components/ui/button";
import type { TeachStepProps } from "../types";

/** The card or diagram step: the server-rendered slot, then Continue. */
export function TeachStep({ meta, slot, onContinue }: TeachStepProps) {
  return (
    <div className="flex flex-col gap-4">
      <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
        {meta}
      </p>
      {slot}
      <div>
        <Button onClick={onContinue} className="min-h-10">
          Continue
        </Button>
      </div>
    </div>
  );
}
