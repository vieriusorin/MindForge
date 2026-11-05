import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { planSeedPlanting } from "@/engine/content";
import { treeStage } from "@/engine/forest";
import { memoryBySkill } from "@/engine/memory";
import { toPlayableQuestions } from "@/engine/questions";
import { SeedChecks } from "@/features/seed-planting/components/seed-checks";
import { SeedPrimer } from "@/features/seed-planting/components/seed-primer";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";

async function PlantSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]/plant/[skill]">["params"];
}) {
  const { packSlug, skill } = await params;
  const user = await getCurrentUser();
  if (!user) {
    redirect(
      `/sign-in?next=${encodeURIComponent(`/play/${packSlug}/plant/${skill}`)}`,
    );
  }
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, content, hashes, review, attempts] = await Promise.all([
    getPack(packSlug),
    getPackContent(packSlug),
    getItemHashes(packSlug),
    getReviewContext(user.id, packSlug),
    listMyAttempts(user.id, packSlug),
  ]);
  const skillInfo = pack.domains
    .flatMap((d) => d.skills)
    .find((s) => s.code === skill);
  if (!skillInfo) notFound();

  // MF-0010 SC-6: one engine decision for the card, the diagram and the checks.
  const plan = planSeedPlanting({ content, review, skill });
  const memory = memoryBySkill(attempts, new Date()).get(skill) ?? null;

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name} · Seed Planting
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">{skillInfo.name}</h1>
      </header>
      <div className="flex flex-col gap-6">
        <SeedPrimer card={plan.card} diagram={plan.diagram} />
        <SeedChecks
          packSlug={packSlug}
          // MF-0032: each check carries the version this page shows.
          checks={toPlayableQuestions(plan.checks, hashes)}
          wasSeed={treeStage(memory).stage === "seed"}
          forestHref="/today"
        />
      </div>
    </>
  );
}

export default function PlantPage({
  params,
}: PageProps<"/play/[packSlug]/plant/[skill]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-6">
            <Skeleton className="h-10 w-72" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <PlantSlot params={params} />
      </Suspense>
    </div>
  );
}
