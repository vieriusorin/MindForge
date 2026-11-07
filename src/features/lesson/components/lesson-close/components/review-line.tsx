import type { ReviewLineProps } from "../types";

/** The review line; the zone sits in its own span so the date reads cleanly. */
export function ReviewLine({ line }: ReviewLineProps) {
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      <span>{line.text}</span>
      {line.zone && <span> {line.zone}</span>}
    </p>
  );
}
