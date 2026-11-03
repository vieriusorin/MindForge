import { StageIcon } from "@/components/stage-icon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatWeight } from "@/lib/forest-display";
import type { FocusListProps } from "./types";

export function FocusList({ skills }: FocusListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Up next <Badge variant="secondary">{skills.length}</Badge>
        </CardTitle>
        <CardDescription>
          Fading trees first, then the heaviest skills you haven&apos;t grown
        </CardDescription>
      </CardHeader>
      <CardContent>
        {skills.length === 0 ? (
          <p className="text-muted-foreground">
            Every skill is growing and none are fading.
          </p>
        ) : (
          <ul>
            {skills.map((s, i) => (
              <li key={s.skillCode}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <StageIcon stage={s.stage} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="truncate">{s.domainName}</span>
                      {s.wilting ? (
                        <Badge variant="destructive">Fading</Badge>
                      ) : (
                        <Badge variant="secondary">Not planted</Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold tabular-nums">
                      {formatWeight(s.weight)}
                    </p>
                    <p className="text-xs text-muted-foreground">of exam</p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
