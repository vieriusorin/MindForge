import { Route } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type { GroupPathCardProps } from "./types";

/** MF-0059 (Q4): the path a group follows and its current course. No figure about other members. */
export function GroupPathCard({ view, moveButton }: GroupPathCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route aria-hidden className="size-4" />
          {view.title}
        </CardTitle>
        <CardDescription className="tabular-nums">
          {view.positionLine}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ol aria-label="Courses in order">
          {view.rows.map((row, index) => (
            <li key={row.slug}>
              {index > 0 && <Separator />}
              <div
                className="flex min-h-10 items-center justify-between gap-3 py-2"
                aria-current={row.isCurrent ? "step" : undefined}
              >
                <span className={row.isCurrent ? "font-semibold" : undefined}>
                  {row.name}
                </span>
                {row.isCurrent ? <Badge>Current course</Badge> : null}
              </div>
            </li>
          ))}
        </ol>
      </CardContent>
      {moveButton ? <CardFooter>{moveButton}</CardFooter> : null}
    </Card>
  );
}
