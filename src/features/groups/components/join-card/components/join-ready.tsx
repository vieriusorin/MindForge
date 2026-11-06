"use client";

import { Button } from "@/components/ui/button";
import { useJoinCard } from "../hooks/use-join-card";
import type { JoinReadyProps } from "../types";

export function JoinReady({ code, groupName, notice }: JoinReadyProps) {
  const { join, isPending, errorMessage } = useJoinCard(code);
  return (
    <div className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        You&apos;ve been invited to {groupName}.
      </p>
      {notice ? <p>{notice}</p> : null}
      <Button type="button" size="lg" onClick={join} disabled={isPending}>
        {isPending ? "Joining…" : "Join the group"}
      </Button>
      {errorMessage ? (
        <p role="alert" className="text-sm text-destructive">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
