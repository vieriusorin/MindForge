import Link from "next/link";
import { StageIcon } from "@/components/stage-icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NODE_MODE_LABEL,
  startNodeHref,
} from "@/features/course-map/utils/start-node";
import { STAGE_LABEL } from "@/lib/forest-display";
import { cn } from "@/lib/utils";
import type { MapNodeProps } from "../types";

/** One skill: its tree, its stage and health in words, and the mode a tap opens. */
export function MapNode({ packSlug, node, marker }: MapNodeProps) {
  const modeLabel = NODE_MODE_LABEL[node.mode];
  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg py-3",
        marker && "-mx-2 bg-accent px-2",
      )}
    >
      <StageIcon stage={node.stage} />
      <div className="grid min-w-0 flex-1 gap-1">
        <p className="font-semibold leading-snug">{node.name}</p>
        <p className="flex flex-wrap items-center gap-1.5">
          <Badge variant="outline">{STAGE_LABEL[node.stage]}</Badge>
          {node.wilting && <Badge variant="destructive">Fading</Badge>}
          {node.isDone && <Badge variant="secondary">Done</Badge>}
          {marker && <Badge>{marker}</Badge>}
        </p>
      </div>
      <Button
        asChild
        size="sm"
        variant={marker ? "default" : "outline"}
        className="min-h-10 shrink-0"
      >
        <Link
          href={startNodeHref({
            packSlug,
            skillCode: node.skillCode,
            mode: node.mode,
          })}
          aria-label={`${modeLabel}: ${node.name}`}
        >
          {modeLabel}
        </Link>
      </Button>
    </div>
  );
}
