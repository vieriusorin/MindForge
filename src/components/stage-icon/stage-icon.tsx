import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { STAGE_ICON, STAGE_LABEL } from "@/lib/forest-display";
import type { StageIconProps } from "./types";

/** A forest stage as a lucide icon in a tinted shadcn Avatar tile; the stage label is its accessible name. */
export function StageIcon({ stage, size = "default" }: StageIconProps) {
  const Icon = STAGE_ICON[stage];
  return (
    <Avatar
      className={`shrink-0 rounded-lg ${size === "sm" ? "size-8" : "size-10"}`}
    >
      <AvatarFallback
        className="rounded-lg bg-secondary text-secondary-foreground"
        role="img"
        aria-label={STAGE_LABEL[stage]}
      >
        <Icon className={size === "sm" ? "size-4" : "size-5"} aria-hidden />
      </AvatarFallback>
    </Avatar>
  );
}
