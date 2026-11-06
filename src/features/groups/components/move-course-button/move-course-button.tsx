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
import { useMoveCourseButton } from "./hooks/use-move-course-button";
import type { MoveCourseButtonProps } from "./types";

/** MF-0059 (Q1): admin only (the page renders it for the admin; the database re-checks). */
export function MoveCourseButton(props: MoveCourseButtonProps) {
  const { move, isPending, isDisabled, errorMessage, dialog } =
    useMoveCourseButton(props);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button
              type="button"
              className="min-h-10"
              disabled={isDisabled}
              aria-describedby={
                props.disabledReason ? "move-course-reason" : undefined
              }
            >
              {isPending ? "Moving…" : "Move to next course"}
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{dialog.title}</AlertDialogTitle>
              <AlertDialogDescription>
                {dialog.description}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={move}>Move</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {props.disabledReason ? (
          <p id="move-course-reason" className="text-sm text-muted-foreground">
            {props.disabledReason}
          </p>
        ) : null}
      </div>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
