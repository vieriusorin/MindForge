"use client";

import { CircleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useInviteLink } from "../hooks/use-invite-link";
import type { ResetLinkProps } from "../types";

/** The only client part of the invite card: the reset button and why it failed (MF-0004). */
export function ResetLink({ rotateAction }: ResetLinkProps) {
  const { reset, isResetting, errorMessage } = useInviteLink(rotateAction);
  return (
    <>
      <Button
        type="button"
        variant="link"
        size="sm"
        className="self-start px-0"
        onClick={reset}
        disabled={isResetting}
      >
        {isResetting ? "Resetting…" : "Reset link (old links stop working)"}
      </Button>
      {errorMessage && (
        <Alert variant="destructive">
          <CircleAlert aria-hidden />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      )}
    </>
  );
}
