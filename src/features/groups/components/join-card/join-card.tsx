import { Button } from "@/components/ui/button";
import type { JoinCardProps } from "./types";

export function JoinCard({ joinAction, invalid }: JoinCardProps) {
  if (invalid) {
    return (
      <p role="alert" className="text-destructive">
        This invite link is invalid or has been reset. Ask a group member for a
        new one.
      </p>
    );
  }
  return (
    <form action={joinAction} className="flex flex-col gap-4">
      <p className="text-muted-foreground">
        You&apos;ve been invited to a MindForge study group.
      </p>
      <Button type="submit" size="lg">
        Join the group
      </Button>
    </form>
  );
}
