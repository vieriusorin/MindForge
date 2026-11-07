import { Swords } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  NODE_MODE_LABEL,
  packDuelHref,
  startNodeHref,
} from "@/features/course-map/utils/start-node";
import type { NextStepBannerProps } from "../types";
import {
  atSaplingLine,
  fadingLine,
  findNextNode,
  nextStepReason,
  STEP_MARKER,
} from "../utils";

/** The briefing banner: the map's done figure and its one next step with a single Start. */
export function NextStepBanner({ packSlug, map }: NextStepBannerProps) {
  const node = findNextNode(map);
  const fading = fadingLine(map.wiltingSkills);
  return (
    <Card className="bg-hero gap-4 py-6 ring-0">
      <CardHeader className="gap-3 px-6">
        <CardDescription className="text-xs font-medium tracking-wider text-white/70 uppercase tabular-nums">
          {atSaplingLine(map.doneCount, map.totalSkills)}
          {fading && ` · ${fading}`}
        </CardDescription>
        {node && map.next.kind !== "done" ? (
          <>
            <CardTitle className="text-2xl leading-snug font-normal text-white">
              <span className="font-semibold">
                {STEP_MARKER[map.next.kind]}:
              </span>{" "}
              {node.name}
            </CardTitle>
            <p className="text-sm text-white/75">
              {nextStepReason(map.next.kind)}
            </p>
            <div>
              <Button
                asChild
                size="lg"
                variant="secondary"
                className="min-h-10"
              >
                <Link
                  href={startNodeHref({
                    packSlug,
                    skillCode: node.skillCode,
                    mode: node.mode,
                  })}
                >
                  Start {NODE_MODE_LABEL[node.mode]}
                </Link>
              </Button>
            </div>
          </>
        ) : (
          <>
            <CardTitle className="text-2xl leading-snug font-semibold text-white">
              Every skill is at Sapling.
            </CardTitle>
            <p className="text-sm text-white/75">
              The Daily Walk waters any skill that starts to fade.
            </p>
            <div>
              <Button asChild variant="secondary" className="min-h-10">
                <Link href={packDuelHref(packSlug)}>
                  <Swords aria-hidden /> Play a Scenario Duel
                </Link>
              </Button>
            </div>
          </>
        )}
      </CardHeader>
    </Card>
  );
}
