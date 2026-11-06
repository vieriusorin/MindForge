"use client";

import { Ellipsis, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePathMenu } from "./hooks/use-path-menu";
import type { PathMenuProps } from "./types";

/** MF-0058 SC-7: Leave path lives in a menu, so it isn't one stray tap away. */
export function PathMenu({ pathSlug }: PathMenuProps) {
  const { leave, isPending, errorMessage } = usePathMenu({ pathSlug });
  return (
    <div className="flex flex-col items-end gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="size-10"
            aria-label="Path options"
            disabled={isPending}
          >
            <Ellipsis aria-hidden />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled={isPending} onSelect={leave}>
            <LogOut aria-hidden /> Leave path
          </DropdownMenuItem>
          <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
            Your completed courses stay.
          </DropdownMenuLabel>
        </DropdownMenuContent>
      </DropdownMenu>
      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
