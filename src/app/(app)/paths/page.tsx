import { redirect } from "next/navigation";
import { Suspense } from "react";
import { pathProgress } from "@/engine/path";
import { PathList } from "@/features/paths/components/path-list";
import { PathListSkeleton } from "@/features/paths/components/path-skeleton";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPathEnrollment } from "@/server/paths/get-path-enrollment";
import { listCourseCompletions } from "@/server/paths/list-course-completions";
import { listPaths } from "@/server/paths/list-paths";

async function PathsSlot() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/paths");
  const [paths, completions] = await Promise.all([
    listPaths(),
    listCourseCompletions(user.id),
  ]);
  const enrollments = await Promise.all(
    paths.map((path) => getPathEnrollment(user.id, path.slug)),
  );
  // The list shows recorded completes only, so it needs no forest replay.
  const items = paths.map((path, index) => ({
    slug: path.slug,
    name: path.name,
    isEnrolled: enrollments[index] !== null,
    progress: pathProgress({ path, completions, forests: new Map() }),
  }));
  return <PathList paths={items} />;
}

export default function PathsPage() {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          Workspace
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Paths</h1>
      </header>
      <Suspense fallback={<PathListSkeleton />}>
        <PathsSlot />
      </Suspense>
    </div>
  );
}
