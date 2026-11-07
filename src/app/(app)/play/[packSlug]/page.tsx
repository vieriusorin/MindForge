import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { plantableSkills } from "@/engine/content";
import { courseMap } from "@/engine/path";
import { CourseMap } from "@/features/course-map/components/course-map";
import { CourseMapSkeleton } from "@/features/course-map/components/course-map-skeleton";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPackContent } from "@/server/content/get-pack-content";
import { getReviewContext } from "@/server/content/get-review-context";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { getMyCourseForest } from "@/server/paths/get-my-course-forest";

async function CourseMapSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]">["params"];
}) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play/${packSlug}`)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  // MF-0062 SC-5: the same forest read as the path page, so a course's figures agree on both screens.
  const [pack, forest, content, review] = await Promise.all([
    getPack(packSlug),
    getMyCourseForest({ userId: user.id, packSlug, now: new Date() }),
    getPackContent(packSlug),
    getReviewContext(user.id, packSlug),
  ]);
  // MF-0010: a Seed or Sprout opens Seed Planting only when its skill has something to plant.
  const plantable = plantableSkills({
    content,
    review,
    skills: pack.domains.flatMap((d) => d.skills.map((s) => s.code)),
  });
  const map = courseMap({ forest, plantable, hasExam: pack.exam != null });

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Course map</h1>
      </header>
      <CourseMap packSlug={packSlug} map={map} />
    </>
  );
}

export default function CourseMapPage({
  params,
}: PageProps<"/play/[packSlug]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense fallback={<CourseMapSkeleton />}>
        <CourseMapSlot params={params} />
      </Suspense>
    </div>
  );
}
