"use client";

import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useStartPathButton } from "./hooks/use-start-path-button";
import type { StartPathButtonProps } from "./types";

/** MF-0058 SC-7: Start path, shown while the learner isn't enrolled. */
export function StartPathButton({ pathSlug }: StartPathButtonProps) {
  const { start, isPending, errorMessage } = useStartPathButton({ pathSlug });
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        size="lg"
        className="h-10"
        disabled={isPending}
        onClick={start}
      >
        <Play aria-hidden data-icon="inline-start" />
        {isPending ? "Starting…" : "Start path"}
      </Button>
      {errorMessage && (
        <p role="alert" className="text-xs text-destructive">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
