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
import type { FinishStormDialogProps } from "../types";

/** Finish sits behind a confirmation: the storm cannot be resumed once graded. */
export function FinishStormDialog({
  warning,
  isFinishing,
  isLocked,
  onConfirm,
}: FinishStormDialogProps) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button type="button" disabled={isLocked}>
          {isFinishing ? "Finishing…" : "Finish the storm"}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Finish the storm now?</AlertDialogTitle>
          <AlertDialogDescription>
            {warning} You will see your score and every answer, and the storm
            cannot be resumed.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep going</AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm}>Finish</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
