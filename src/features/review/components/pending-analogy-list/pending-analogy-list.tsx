import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatReviewDate } from "../../utils/format-date";
import { ApproveAnalogyButton } from "../approve-analogy-button";
import type { PendingAnalogyListProps } from "./types";

/** MF-0007 SC-6: nature cards waiting for the analogy owner (or the 48 h maintainer fallback). */
export function PendingAnalogyList({
  analogies,
  titles,
  contentHashes,
}: PendingAnalogyListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Analogies to approve</CardTitle>
        <CardDescription>
          A nature card also needs its analogy approved before it counts as
          approved.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {analogies.length === 0 ? (
          <p className="text-muted-foreground">No card is waiting.</p>
        ) : (
          <ul className="grid gap-3">
            {analogies.map((a, index) => (
              <li key={a.itemId} className="grid gap-3">
                {index > 0 && <Separator />}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="grid gap-0.5">
                    <p className="font-semibold">
                      {titles[a.itemId] ?? a.itemId}
                    </p>
                    <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="secondary">
                        <span className="tabular-nums">{a.approvals}</span>{" "}
                        reviewer approvals
                      </Badge>
                      <span>
                        synced{" "}
                        <time dateTime={a.hashSyncedAt}>
                          {formatReviewDate(a.hashSyncedAt)}
                        </time>
                      </span>
                    </p>
                  </div>
                  <ApproveAnalogyButton
                    itemId={a.itemId}
                    contentHash={contentHashes[a.itemId] ?? ""}
                    canApprove={a.canApprove && a.itemId in contentHashes}
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
