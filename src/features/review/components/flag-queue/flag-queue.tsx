import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FlagRow } from "./components/flag-row";
import { ItemDecision } from "./components/item-decision";
import type { FlagQueueProps } from "./types";
import { groupFlagsByItem } from "./utils";

/** MF-0007 SC-4/SC-9: each flagged item with its open flags and the maintainer's decision. */
export function FlagQueue({ flags, titles, contentHashes }: FlagQueueProps) {
  const items = groupFlagsByItem(flags);
  if (items.length === 0)
    return (
      <Card>
        <CardHeader>
          <CardTitle>No open flags</CardTitle>
          <CardDescription>
            Every flagged item has been dismissed or rejected.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  return (
    <div className="grid gap-6">
      {items.map(({ itemId, flags: itemFlags }) => (
        <Card key={itemId}>
          <CardHeader>
            <CardDescription className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs">{itemId}</span>
              <Badge variant="destructive">
                <span className="tabular-nums">{itemFlags.length}</span> open
              </Badge>
            </CardDescription>
            <CardTitle className="leading-snug">
              {titles[itemId] ?? itemId}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <ul className="grid gap-4">
              {itemFlags.map((flag) => (
                <FlagRow key={flag.flagId} flag={flag} />
              ))}
            </ul>
            <Separator />
            <ItemDecision itemId={itemId} contentHash={contentHashes[itemId]} />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
