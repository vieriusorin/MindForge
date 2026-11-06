import { Mountain } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import type { ExpeditionCardProps } from "./types";
import {
  goalLine,
  movedOnLine,
  noneLine,
  progressLine,
  statusLook,
  timeLeftLabel,
  tooSmallLine,
} from "./utils";

function Title() {
  return (
    <CardTitle className="flex items-center gap-2">
      <Mountain aria-hidden className="size-4" />
      Group expedition
    </CardTitle>
  );
}

/** MF-0017: the group's shared goal, at its own pace (MF-0059). Group total only (Q5); figures from the engine. */
export function ExpeditionCard(props: ExpeditionCardProps) {
  if (props.status === "too-small") {
    return (
      <Card>
        <CardHeader>
          <Title />
          <CardDescription>{tooSmallLine(props.minMembers)}</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (props.status === "none") {
    return (
      <Card>
        <CardHeader>
          <Title />
          <CardDescription>
            {noneLine(Boolean(props.startForm))}
          </CardDescription>
        </CardHeader>
        {props.startForm ? <CardContent>{props.startForm}</CardContent> : null}
      </Card>
    );
  }

  const { summary } = props;
  const look = statusLook(summary.status);
  const line = progressLine({
    progress: props.progress,
    target: props.target,
    percent: summary.percent,
  });
  return (
    <Card>
      <CardHeader>
        <Title />
        <CardDescription>
          {goalLine({ target: props.target, domainName: props.domainName })}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <Badge variant={look.badge}>{look.label}</Badge>
          <span className="text-sm text-muted-foreground tabular-nums">
            {props.movedOn ? movedOnLine() : timeLeftLabel(summary.timeLeft)}
          </span>
        </div>
        <Progress value={summary.percent} aria-label={line} className="h-2" />
        <p className="text-sm font-medium tabular-nums">{line}</p>
        {props.endButton}
        {props.startForm ? (
          <div className="mt-2 border-t pt-4">{props.startForm}</div>
        ) : null}
      </CardContent>
    </Card>
  );
}
