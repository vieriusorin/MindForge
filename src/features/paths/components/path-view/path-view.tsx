import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { PathProgressSummary } from "@/features/paths/components/path-progress";
import { CourseRow } from "./components/course-row";
import type { PathViewProps } from "./types";
import { COMPLETION_RULE, SOURCE_LINK_LABEL, SOURCE_NOTE } from "./utils";

/** MF-0058 SC-7: one path, its courses in order, and the learner's progress through them. */
export function PathView({
  name,
  source,
  isEnrolled,
  progress,
  courses,
  actions,
}: PathViewProps) {
  return (
    <>
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Path
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">{name}</h1>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {SOURCE_NOTE}{" "}
            <a
              href={source}
              className="text-primary underline-offset-4 hover:underline"
            >
              {SOURCE_LINK_LABEL}
            </a>
          </p>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </header>

      <p className="mb-6 max-w-prose text-sm text-muted-foreground">
        {COMPLETION_RULE}
      </p>

      {(isEnrolled || progress.isPathComplete) && (
        <Card className="mb-6">
          <CardContent>
            <PathProgressSummary progress={progress} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-xl">Courses</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol>
            {courses.map((course, index) => (
              <li key={course.packSlug}>
                {index > 0 && <Separator />}
                <CourseRow course={course} showHealth={isEnrolled} />
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
