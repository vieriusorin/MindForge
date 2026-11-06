"use client";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { useEndExpeditionButton } from "./hooks/use-end-expedition-button";
import type { EndExpeditionButtonProps } from "./types";

/** MF-0059: admin only (the page renders it for the admin; the database re-checks). */
export function EndExpeditionButton(props: EndExpeditionButtonProps) {
  const { end, isPending, errorMessage } = useEndExpeditionButton(props);
  return (
    <div className="flex flex-col gap-2">
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            variant="outline"
            className="min-h-10 self-start"
            disabled={isPending}
          >
            {isPending ? "Ending…" : "End expedition"}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>End the expedition?</AlertDialogTitle>
            <AlertDialogDescription>
              Progress stops counting now. You can start a new one afterwards.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={end}>End expedition</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
