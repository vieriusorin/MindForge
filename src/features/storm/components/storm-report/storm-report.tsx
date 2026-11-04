import { CloudLightning, Info } from "lucide-react";
import { Fragment } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { SURVIVE_PERCENT } from "@/engine/storm";
import type { StormReportProps } from "./types";

/** MF-0013 SC-5: the storm report. Every figure comes from `scoreStorm` / `stormShortfall`. */
export function StormReport({
  report,
  shortfall,
  unreviewedIds,
  domainNames,
  skillNames,
  questionLabels,
}: StormReportProps) {
  return (
    <div className="flex flex-col gap-6">
      {shortfall.length > 0 && (
        <Alert>
          <Info aria-hidden />
          <AlertTitle>This storm was shorter than planned</AlertTitle>
          <AlertDescription>
            <p>Not enough playable questions you haven&apos;t reviewed:</p>
            <ul className="list-disc pl-5">
              {shortfall.map((d) => (
                <li key={d.domainCode} className="tabular-nums">
                  {domainNames[d.domainCode] ?? d.domainCode}: {d.actual} of{" "}
                  {d.planned} questions
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              <h2>By domain</h2>
            </CardTitle>
            <CardDescription>
              A domain survives at {SURVIVE_PERCENT}% or more. Unanswered
              questions count as wrong.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.domains.map((d, i) => (
              <Fragment key={d.domainCode}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <CloudLightning
                    aria-hidden
                    className="size-4 shrink-0 text-primary"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold">
                      {domainNames[d.domainCode] ?? d.domainCode}
                    </p>
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {d.correct} of {d.scored} right
                    </p>
                  </div>
                  <Badge variant={d.survived ? "default" : "outline"}>
                    {d.survived ? "Survived" : "Not yet"}
                  </Badge>
                  <span className="w-14 text-right text-lg font-semibold tabular-nums">
                    {d.percent}%
                  </span>
                </div>
              </Fragment>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">
              <h2>By skill</h2>
            </CardTitle>
            <CardDescription>
              A proven skill counts toward its tree in your forest.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {report.skills.map((s, i) => (
              <Fragment key={s.skillCode}>
                {i > 0 && <Separator />}
                <div className="flex items-center gap-3 py-3">
                  <p className="min-w-0 flex-1 font-medium">
                    {skillNames[s.skillCode] ?? s.skillCode}
                  </p>
                  {s.proven && <Badge>Proven</Badge>}
                  <span className="text-sm text-muted-foreground tabular-nums">
                    {s.correct} of {s.scored}
                  </span>
                </div>
              </Fragment>
            ))}
          </CardContent>
        </Card>
      </div>

      {(report.voided.length > 0 || unreviewedIds.length > 0) && (
        <Card size="sm">
          <CardContent className="flex flex-col gap-3 text-sm">
            {report.voided.length > 0 && (
              <p>
                <span className="font-semibold">Voided, not scored: </span>
                {report.voided.map((id) => questionLabels[id] ?? id).join(", ")}
                . They changed or were removed during or after the storm, so
                they don't count.
              </p>
            )}
            {unreviewedIds.length > 0 && (
              <p>
                <span className="font-semibold">Unreviewed: </span>
                {unreviewedIds.map((id) => questionLabels[id] ?? id).join(", ")}
                . Not enough reviewed questions were ready, so these came from
                the unreviewed pool.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
