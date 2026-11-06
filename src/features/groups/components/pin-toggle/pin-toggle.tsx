"use client";

import { Pin, PinOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { usePinToggle } from "./hooks/use-pin-toggle";
import type { PinToggleProps } from "./types";

/**
 * MF-0054 SC-6: a constant accessible name (the group makes it unique per row) with the state in
 * `aria-pressed`, so a screen reader announces it once. The tooltip says what a click does.
 */
export function PinToggle({ groupId, groupName, isPinned }: PinToggleProps) {
  const { toggle, isPending, statusMessage, errorMessage } = usePinToggle({
    groupId,
    isPinned,
  });
  // `contents`: the button and the messages join the parent's wrapping flex row (no row gap), so a
  // message takes a full line under the row instead of squeezing the row link beside it. The empty
  // live region stays in the a11y tree at zero height, so the message that fills it is announced.
  return (
    <div className="contents">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant={isPinned ? "secondary" : "ghost"}
            size="icon"
            className="size-10"
            aria-label={`Pin ${groupName} to sidebar`}
            aria-pressed={isPinned}
            disabled={isPending}
            onClick={toggle}
          >
            {isPinned ? <PinOff aria-hidden /> : <Pin aria-hidden />}
          </Button>
        </TooltipTrigger>
        <TooltipContent>{isPinned ? "Unpin" : "Pin to sidebar"}</TooltipContent>
      </Tooltip>
      <output className="basis-full text-right text-xs text-muted-foreground not-empty:mt-1">
        {statusMessage}
      </output>
      {errorMessage && (
        <p
          role="alert"
          className="mt-1 basis-full text-right text-xs text-destructive"
        >
          {errorMessage}
        </p>
      )}
    </div>
  );
}
