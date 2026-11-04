import { Footprints, Swords } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { WalkActionProps } from "../types";
import { needWaterLabel, walkLengthLabel } from "../utils";

/** MF-0009: the one main action of the day, or the healthy-forest message with the Duel. */
export function WalkAction({ walk }: WalkActionProps) {
  if (walk.isHealthy) {
    return (
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="font-semibold text-white">
          Your forest is healthy today.
        </p>
        <Button asChild variant="secondary">
          <Link href={walk.duelHref}>
            <Swords aria-hidden /> Play a Duel instead
          </Link>
        </Button>
      </div>
    );
  }
  return (
    <div className="mt-3 flex flex-wrap items-center gap-3">
      <Button asChild size="lg">
        <Link href={walk.href}>
          <Footprints aria-hidden /> Start today&apos;s walk
        </Link>
      </Button>
      <p className="text-sm text-white/75">
        <span className="font-semibold text-white tabular-nums">
          {needWaterLabel(walk.needWaterCount)}
        </span>{" "}
        ·{" "}
        <span className="tabular-nums">{walkLengthLabel(walk.stepCount)}</span>
      </p>
    </div>
  );
}
