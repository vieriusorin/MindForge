import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { formatUtcDate } from "@/lib/format-utc-date";
import { initials } from "@/lib/initials";
import type { FlagRowProps } from "../types";

const UNKNOWN_REVIEWER = "A former reviewer";

export function FlagRow({ flag }: FlagRowProps) {
  const name = flag.reviewerName ?? UNKNOWN_REVIEWER;
  return (
    <li className="flex items-start gap-3">
      <Avatar aria-label={name}>
        <AvatarFallback>{initials(name)}</AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 gap-0.5">
        <p className="font-semibold">{name}</p>
        <p className="text-xs text-muted-foreground">
          <time dateTime={flag.createdAt}>{formatUtcDate(flag.createdAt)}</time>
        </p>
        <p className="mt-1 whitespace-pre-line">{flag.comment}</p>
      </div>
    </li>
  );
}
