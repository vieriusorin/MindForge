"use client";

import { Label, Pie, PieChart } from "recharts";
import { StageIcon } from "@/components/stage-icon";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Separator } from "@/components/ui/separator";
import { STAGE_HINT } from "@/lib/forest-display";
import type { GrowthDonutProps } from "./types";
import { donutData, STAGE_CHART_CONFIG } from "./utils";

export function GrowthDonut({
  stageCounts,
  grownPercent,
  totalSkills,
}: GrowthDonutProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Forest growth</CardTitle>
        <CardDescription>
          Each of the {totalSkills} skills is a tree. It grows only from what
          you actually remember.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer
          config={STAGE_CHART_CONFIG}
          className="mx-auto aspect-square max-h-52"
        >
          <PieChart>
            <ChartTooltip
              cursor={false}
              content={<ChartTooltipContent nameKey="stage" hideLabel />}
            />
            <Pie
              data={donutData(stageCounts)}
              dataKey="count"
              nameKey="stage"
              innerRadius={62}
              strokeWidth={4}
              isAnimationActive={false}
            >
              <Label
                content={({ viewBox }) =>
                  viewBox && "cx" in viewBox && "cy" in viewBox ? (
                    <text
                      x={viewBox.cx}
                      y={viewBox.cy}
                      textAnchor="middle"
                      dominantBaseline="middle"
                    >
                      <tspan
                        x={viewBox.cx}
                        y={viewBox.cy}
                        className="fill-foreground text-3xl font-semibold"
                      >
                        {grownPercent}%
                      </tspan>
                      <tspan
                        x={viewBox.cx}
                        y={(viewBox.cy ?? 0) + 22}
                        className="fill-muted-foreground text-xs"
                      >
                        growing
                      </tspan>
                    </text>
                  ) : null
                }
              />
            </Pie>
          </PieChart>
        </ChartContainer>
        <Separator className="my-4" />
        <ul className="flex flex-col gap-3">
          {donutData(stageCounts).map((d) => (
            <li key={d.stage} className="flex items-start gap-3">
              <StageIcon stage={d.stage} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 font-medium">
                  <span
                    aria-hidden
                    className="size-2 rounded-full"
                    style={{ background: STAGE_CHART_CONFIG[d.stage].color }}
                  />
                  {STAGE_CHART_CONFIG[d.stage].label}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {STAGE_HINT[d.stage]}
                </span>
              </span>
              <Badge variant="secondary" className="tabular-nums">
                {d.count}
              </Badge>
            </li>
          ))}
        </ul>
        {grownPercent === 0 && (
          <p className="mt-4 rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            0% because nothing has been answered yet. Your first correct answer
            in Scenario Duel sprouts that skill&apos;s seed.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
