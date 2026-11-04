"use client";

import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useApproveAnalogy } from "./hooks/use-approve-analogy";
import type { ApproveAnalogyButtonProps } from "./types";

export function ApproveAnalogyButton({
  itemId,
  contentHash,
  canApprove,
}: ApproveAnalogyButtonProps) {
  const { onApprove, isApproving, error } = useApproveAnalogy({
    itemId,
    contentHash,
  });
  return (
    <div className="grid justify-items-end gap-1">
      <Button
        type="button"
        size="sm"
        onClick={onApprove}
        disabled={!canApprove || isApproving}
      >
        <Leaf aria-hidden />
        {isApproving ? "Approving…" : "Approve analogy"}
      </Button>
      {!canApprove && (
        <p className="text-xs text-muted-foreground">
          The analogy owner decides first; any maintainer may after 48 hours.
        </p>
      )}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}
