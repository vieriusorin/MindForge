import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { stormDurationSeconds } from "@/engine/storm";
import { StormStart } from "@/features/storm/components/storm-start";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { finalizeExpiredStorms } from "@/server/storm/finalize-expired-storms";
import { getRunningStorm } from "@/server/storm/get-running-storm";

async function FullStormSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]/storm/full">["params"];
}) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/play/${packSlug}/storm/full`)}`,
    );
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  // MF-0013: a past-deadline storm is graded before we decide whether one is still running.
  await finalizeExpiredStorms();
  const [pack, running] = await Promise.all([
    getPack(packSlug),
    getRunningStorm(user.id),
  ]);
  if (running) redirect(`/storms/${running.id}`);
  if (!pack.exam) notFound();

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Full Storm</h1>
        <p className="mt-2 text-muted-foreground">
          A timed mock exam across every domain, weighted like the real one.
        </p>
      </header>
      <div className="flex flex-col gap-6">
        <StormStart
          packSlug={packSlug}
          kind="full"
          domainCode={null}
          questionCount={pack.exam.questions}
          durationSeconds={stormDurationSeconds(pack.exam, pack.exam.questions)}
        />
        <section aria-labelledby="boss-storms" className="flex flex-col gap-3">
          <h2 id="boss-storms" className="text-xl font-semibold">
            Or face one domain in a Boss Storm
          </h2>
          <ul className="flex flex-wrap gap-2">
            {pack.domains.map((d) => (
              <li key={d.code}>
                <Button asChild variant="outline">
                  <Link href={`/play/${packSlug}/storm/boss/${d.code}`}>
                    {d.code}: {d.name}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

export default function FullStormPage({
  params,
}: PageProps<"/play/[packSlug]/storm/full">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-56 w-full rounded-xl" />
          </div>
        }
      >
        <FullStormSlot params={params} />
      </Suspense>
    </div>
  );
}
