import { Avatar, AvatarFallback } from "@/components/ui/avatar";
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
import type { ReadinessCardProps } from "./types";
import {
  forecastLabel,
  overallLabel,
  stormLabel,
  WEATHER_DISPLAY,
} from "./utils";

/** MF-0015: readiness weather per region. Every figure comes from `readiness()` in the engine. */
export function ReadinessCard({ readiness }: ReadinessCardProps) {
  const overall = WEATHER_DISPLAY[readiness.overallWeather];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Readiness</CardTitle>
        <CardDescription>
          Exam day {readiness.examDate}: the lower of your memory forecast and
          your last storm, per region
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul>
          {readiness.domains.map((d, i) => {
            const weather = WEATHER_DISPLAY[d.weather];
            const Icon = weather.icon;
            return (
              <li key={d.domainCode}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <Avatar className="size-10 shrink-0 rounded-lg">
                    <AvatarFallback className="rounded-lg bg-secondary text-secondary-foreground">
                      <Icon className="size-5" aria-hidden />
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{d.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      {forecastLabel(d.forecastPercent)} ·{" "}
                      {stormLabel(d.stormPercent)}
                    </p>
                  </div>
                  <Badge variant={weather.badge}>{weather.label}</Badge>
                </div>
              </li>
            );
          })}
        </ul>
      </CardContent>
      <CardFooter className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
        <span className="font-medium">
          Overall{" "}
          <span className="tabular-nums">
            {overallLabel(readiness.overallPercent)}
          </span>
        </span>
        <Badge variant={overall.badge}>{overall.label}</Badge>
        <span className="text-muted-foreground tabular-nums">
          Pass mark {readiness.passMarkPercent}% (approx.)
        </span>
      </CardFooter>
    </Card>
  );
}
