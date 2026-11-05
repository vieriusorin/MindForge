import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatUtcDate } from "@/lib/format-utc-date";
import type { RecentStormsProps } from "./types";

const VERDICT = {
  survived: { label: "Survived", variant: "secondary" },
  notSurvived: { label: "Not survived", variant: "destructive" },
} as const satisfies Record<
  "survived" | "notSurvived",
  { label: string; variant: "secondary" | "destructive" }
>;

/** MF-0052 SC-11: your recent finished storms, each linking to its report. Nothing when there are none. */
export function RecentStorms({ rows }: RecentStormsProps) {
  if (rows.length === 0) return null;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h2>Your recent storms</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul>
          {rows.map((row, i) => {
            const verdict = VERDICT[row.survived ? "survived" : "notSurvived"];
            return (
              <li key={row.id}>
                {i > 0 && <Separator />}
                <Link
                  href={row.href}
                  className="-mx-2 flex min-h-10 items-center gap-3 rounded-md px-2 py-3 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">{row.kindLabel}</p>
                    <time
                      dateTime={row.finishedAt}
                      className="block text-sm text-muted-foreground tabular-nums"
                    >
                      {formatUtcDate(row.finishedAt)}
                    </time>
                  </div>
                  <Badge variant={verdict.variant}>{verdict.label}</Badge>
                </Link>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
