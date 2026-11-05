import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pack } from "@/engine/pack";
import { stormDurationSeconds } from "@/engine/storm";
import {
  RecentStorms,
  toRecentStormRows,
} from "@/features/storm/components/recent-storms";
import { StormStart } from "@/features/storm/components/storm-start";
import { StormUnavailable } from "@/features/storm/components/storm-unavailable";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { finalizeExpiredStorms } from "@/server/storm/finalize-expired-storms";
import { getRunningStorm } from "@/server/storm/get-running-storm";
import { listMyRecentStorms } from "@/server/storm/list-my-recent-storms";

/** MF-0052 SC-11: your finished storms of this pack, streamed on their own. */
async function RecentStormsSlot({
  pack,
  userId,
}: {
  pack: Pack;
  userId: string;
}) {
  const storms = await listMyRecentStorms(userId, pack.slug);
  return <RecentStorms rows={toRecentStormRows({ pack, storms })} />;
}

/** Sized like the list (title + rows), so nothing jumps when it streams in. */
function RecentStormsSkeleton() {
  return (
    <Card aria-busy="true">
      <CardHeader>
        <Skeleton className="h-7 w-48" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </CardContent>
    </Card>
  );
}

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
  // MF-0052 SC-2: a known pack without an exam explains itself (200), it does not 404.
  if (!pack.exam)
    return (
      <StormUnavailable
        packName={pack.name}
        duelHref={`/play/${packSlug}/duel`}
      />
    );

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
        <Suspense fallback={<RecentStormsSkeleton />}>
          <RecentStormsSlot pack={pack} userId={user.id} />
        </Suspense>
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
