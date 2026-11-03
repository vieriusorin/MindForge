import { StageIcon } from "@/components/stage-icon";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { formatWeight } from "@/lib/forest-display";
import type { ForestProps } from "./types";

export function Forest({ forest }: ForestProps) {
  return (
    <div className="flex flex-col gap-8">
      {forest.regions.map((region) => (
        <section
          key={region.domainCode}
          aria-labelledby={`region-${region.domainCode}`}
        >
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2
              id={`region-${region.domainCode}`}
              className="text-lg font-semibold"
            >
              {region.name}
            </h2>
            <Badge variant="secondary" className="tabular-nums">
              {formatWeight(region.weight)}
            </Badge>
          </div>
          <Separator className="mb-4" />
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] gap-4">
            {region.trees.map((tree) => (
              <li
                key={tree.skillCode}
                data-stage={tree.stage}
                data-wilting={tree.wilting}
              >
                <Card size="sm" className="h-full">
                  <CardContent className="flex flex-col gap-1">
                    <div className="mb-1">
                      <StageIcon stage={tree.stage} />
                    </div>
                    <span className="font-medium leading-snug">
                      {tree.name}
                    </span>
                    <span className="text-xs tabular-nums text-muted-foreground">
                      {formatWeight(tree.weight)}
                    </span>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
