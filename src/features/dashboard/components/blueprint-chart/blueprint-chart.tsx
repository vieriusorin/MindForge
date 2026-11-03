"use client";

import { Bar, BarChart, CartesianGrid, XAxis } from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import type { BlueprintChartProps } from "./types";
import { BLUEPRINT_CHART_CONFIG, blueprintData } from "./utils";

export function BlueprintChart({ domains }: BlueprintChartProps) {
  const data = blueprintData(domains);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Exam blueprint</CardTitle>
        <CardDescription>
          Bar height is each domain&apos;s exam weight (%)
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={BLUEPRINT_CHART_CONFIG} className="h-64 w-full">
          <BarChart accessibilityLayer data={data}>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="code"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(_, p) => p[0]?.payload?.name ?? ""}
                />
              }
            />
            <ChartLegend content={<ChartLegendContent />} itemSorter={null} />
            <Bar
              dataKey="growing"
              stackId="w"
              fill="var(--color-growing)"
              isAnimationActive={false}
              radius={[0, 0, 6, 6]}
            />
            <Bar
              dataKey="notYet"
              stackId="w"
              fill="var(--color-notYet)"
              isAnimationActive={false}
              radius={[6, 6, 0, 0]}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
