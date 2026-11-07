import { CloudLightning } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { bossStormHref } from "@/features/course-map/utils/start-node";
import type { MapCheckpointProps } from "../types";
import { atSaplingLine } from "../utils";

/** The Boss Storm at the end of a domain. Always open: nothing on the map is locked. */
export function MapCheckpoint({
  packSlug,
  domain,
  checkpoint,
}: MapCheckpointProps) {
  return (
    <div className="flex items-center gap-3 py-3">
      <Avatar className="size-10 shrink-0 rounded-lg">
        <AvatarFallback className="rounded-lg bg-primary text-primary-foreground">
          <CloudLightning className="size-5" aria-hidden />
        </AvatarFallback>
      </Avatar>
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-semibold leading-snug">Checkpoint</p>
        <p className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground tabular-nums">
          {checkpoint.isReady ? (
            <Badge>Ready</Badge>
          ) : (
            <span>{atSaplingLine(domain.doneCount, domain.skillCount)}</span>
          )}
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant="secondary"
        className="min-h-10 shrink-0"
      >
        <Link
          href={bossStormHref({ packSlug, domainCode: domain.domainCode })}
          aria-label={`Boss Storm: ${domain.name}`}
        >
          Boss Storm
        </Link>
      </Button>
    </div>
  );
}
