import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { MIN_OTHER_CONTRIBUTORS } from "@/engine/forest";
import type { GroupHeatmapProps } from "./types";
import {
  HEAT_BUCKETS,
  heatBucket,
  notEnoughDataLine,
  regionFigures,
  SWATCH_CLASS,
  statusLook,
} from "./utils";

/** MF-0011: where the group is holding and fading, per region. Aggregates only (D-4). */
export function GroupHeatmap({ heatmap }: GroupHeatmapProps) {
  if (heatmap.status === "not-enough-data") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Group heatmap</CardTitle>
          <CardDescription>
            {notEnoughDataLine(MIN_OTHER_CONTRIBUTORS)}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Group heatmap</CardTitle>
        <CardDescription>
          Pooled from every member who has played. Shade = share of healthy
          trees.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {heatmap.regions.map((region) => {
            const look = statusLook(region.status);
            return (
              <li key={region.domainCode}>
                <Card size="sm" className="h-full bg-background">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className={`size-4 shrink-0 rounded-sm ring-1 ring-foreground/10 ${SWATCH_CLASS[heatBucket(region.healthyPercent)]}`}
                      />
                      <span className="min-w-0 flex-1">{region.name}</span>
                      <Badge variant={look.badge}>{look.label}</Badge>
                    </CardTitle>
                    <CardDescription className="tabular-nums">
                      {regionFigures(region)}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span>Healthy trees:</span>
          <ul className="flex flex-wrap gap-3">
            {HEAT_BUCKETS.map((b) => (
              <li
                key={b.bucket}
                className="flex items-center gap-1.5 tabular-nums"
              >
                <span
                  aria-hidden
                  className={`size-3 rounded-sm ring-1 ring-foreground/10 ${SWATCH_CLASS[b.bucket]}`}
                />
                {`${b.from}–${b.to}%`}
              </li>
            ))}
          </ul>
          <span>
            Holding = average recall at least 85%; Fading = below 85%.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
