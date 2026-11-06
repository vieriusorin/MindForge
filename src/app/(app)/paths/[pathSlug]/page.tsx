import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { pathProgress } from "@/engine/path";
import { PathMenu } from "@/features/paths/components/path-menu";
import { PathSkeleton } from "@/features/paths/components/path-skeleton";
import {
  buildCourseRows,
  PathView,
} from "@/features/paths/components/path-view";
import { StartPathButton } from "@/features/paths/components/start-path-button";
import { getCurrentUser } from "@/server/auth/current-user";
import { getMyCourseForest } from "@/server/paths/get-my-course-forest";
import { getPath } from "@/server/paths/get-path";
import { getPathEnrollment } from "@/server/paths/get-path-enrollment";
import { listCourseCompletions } from "@/server/paths/list-course-completions";

async function PathSlot({
  params,
}: {
  params: PageProps<"/paths/[pathSlug]">["params"];
}) {
  const { pathSlug } = await params;
  const path = await getPath(pathSlug);
  if (!path) notFound();
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/paths/${path.slug}`)}`);

  const now = new Date();
  // MF-0058: every read runs as the learner (RLS); the forest per course is replayed live.
  const [enrollment, completions, forestEntries] = await Promise.all([
    getPathEnrollment(user.id, path.slug),
    listCourseCompletions(user.id),
    Promise.all(
      path.courses.map(
        async (packSlug) =>
          [
            packSlug,
            await getMyCourseForest({ userId: user.id, packSlug, now }),
          ] as const,
      ),
    ),
  ]);
  const forests = new Map(forestEntries);
  // MF-0058 SC-8: the same engine call as Today's Path card, so n of N and Continue agree.
  const progress = pathProgress({ path, completions, forests });
  const isEnrolled = enrollment !== null;

  return (
    <PathView
      name={path.name}
      source={path.source}
      isEnrolled={isEnrolled}
      progress={progress}
      courses={buildCourseRows({ courses: progress.courses, forests })}
      actions={
        isEnrolled ? (
          <PathMenu pathSlug={path.slug} />
        ) : (
          <StartPathButton pathSlug={path.slug} />
        )
      }
    />
  );
}

export default function PathPage({ params }: PageProps<"/paths/[pathSlug]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense fallback={<PathSkeleton />}>
        <PathSlot params={params} />
      </Suspense>
    </div>
  );
}
