import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { lessonOutcome } from "@/engine/lesson";
import { LessonClose } from "@/features/lesson/components/lesson-close";
import {
  lessonHref,
  loadLessonDoneParams,
} from "@/features/lesson/search-params";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { listMyStormResults } from "@/server/storm/list-my-storm-results";

async function DoneSlot({
  params,
  searchParams,
}: PageProps<"/play/[packSlug]/lesson/[skill]/done">) {
  const [{ packSlug, skill }, { since }] = await Promise.all([
    params,
    loadLessonDoneParams(searchParams),
  ]);
  // Same as Seed Planting: the segment is matched against pack skill codes as given.
  const skillCode = skill;
  const back = lessonHref({ packSlug, skillCode });
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(back)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();
  // MF-0064 D-L10: without a start time there is no "before"; start the lesson again.
  if (!since) redirect(back);

  const [pack, attempts, review, stormResults] = await Promise.all([
    getPack(packSlug),
    listMyAttempts(user.id, packSlug),
    getReviewContext(user.id, packSlug),
    listMyStormResults(user.id, packSlug),
  ]);
  const skillInfo = pack.domains
    .flatMap((d) => d.skills)
    .find((s) => s.code === skillCode);
  if (!skillInfo) notFound();

  const outcome = lessonOutcome({
    pack,
    attempts,
    review,
    stormResults,
    skillCode,
    since,
    now: new Date(),
  });

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name} · Lesson
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">{skillInfo.name}</h1>
      </header>
      <LessonClose outcome={outcome} mapHref={`/play/${packSlug}`} />
    </>
  );
}

export default function LessonDonePage(
  props: PageProps<"/play/[packSlug]/lesson/[skill]/done">,
) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-64 w-full" />
          </div>
        }
      >
        <DoneSlot {...props} />
      </Suspense>
    </div>
  );
}
