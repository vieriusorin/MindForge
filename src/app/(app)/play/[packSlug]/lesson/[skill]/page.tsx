import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { DiagramFigure } from "@/components/diagram-figure";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { planLesson } from "@/engine/lesson";
import { LessonPlayer } from "@/features/lesson/components/lesson-player";
import { lessonHref } from "@/features/lesson/search-params";
import { toPlayerSteps } from "@/features/lesson/utils/to-player-steps";
import { NatureCardView } from "@/features/seed-planting/components/nature-card";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { getMyCourseForest } from "@/server/paths/get-my-course-forest";

async function LessonSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]/lesson/[skill]">["params"];
}) {
  const { packSlug, skill } = await params;
  // Same as Seed Planting: the segment is matched against pack skill codes as given.
  const skillCode = skill;
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/sign-in?next=${encodeURIComponent(lessonHref({ packSlug, skillCode }))}`,
    );
  }
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const now = new Date();
  // MF-0064 D-L3: the same forest the course map shows decides Seed vs met and the confusable skill.
  const [pack, forest, content, hashes, review, attempts] = await Promise.all([
    getPack(packSlug),
    getMyCourseForest({ userId: user.id, packSlug, now }),
    getPackContent(packSlug),
    getItemHashes(packSlug),
    getReviewContext(user.id, packSlug),
    listMyAttempts(user.id, packSlug),
  ]);
  const skills = pack.domains.flatMap((d) => d.skills);
  const skillInfo = skills.find((s) => s.code === skillCode);
  if (!skillInfo) notFound();

  const plan = planLesson({ skillCode, forest, content, review, attempts });
  const steps = toPlayerSteps({
    steps: plan.steps,
    // MF-0032: each question carries the version this page shows.
    hashes,
    skillNames: new Map(skills.map((s) => [s.code, s.name])),
  });
  const card = plan.steps.find((s) => s.kind === "card");
  const diagram = plan.steps.find((s) => s.kind === "diagram");

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name} · Lesson
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">{skillInfo.name}</h1>
      </header>
      <LessonPlayer
        packSlug={packSlug}
        skillCode={skillCode}
        steps={steps}
        startedAt={now.toISOString()}
        mapHref={`/play/${packSlug}`}
        card={
          card?.kind === "card" && (
            <NatureCardView
              card={{
                id: card.card.id,
                concept: card.card.concept,
                simply: card.card.simply,
                inNature: card.card.inNature,
                whereItBreaks: card.card.whereItBreaks,
                contrast: card.card.contrast,
                whyTheName: card.card.whyTheName,
                sources: card.card.sources,
              }}
            />
          )
        }
        diagram={
          diagram?.kind === "diagram" && (
            <Card>
              <CardHeader>
                <CardTitle>
                  <h2 className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
                    Diagram
                  </h2>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <DiagramFigure
                  id={diagram.diagram.id}
                  title={diagram.diagram.title}
                  direction={diagram.diagram.direction}
                  nodes={diagram.diagram.nodes}
                  edges={diagram.diagram.edges}
                />
              </CardContent>
            </Card>
          )
        }
      />
    </>
  );
}

export default function LessonPage({
  params,
}: PageProps<"/play/[packSlug]/lesson/[skill]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-2 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <LessonSlot params={params} />
      </Suspense>
    </div>
  );
}
