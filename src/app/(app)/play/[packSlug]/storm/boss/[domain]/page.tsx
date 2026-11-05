import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BOSS_STORM_SIZE, stormDurationSeconds } from "@/engine/storm";
import { StormStart } from "@/features/storm/components/storm-start";
import { StormUnavailable } from "@/features/storm/components/storm-unavailable";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { finalizeExpiredStorms } from "@/server/storm/finalize-expired-storms";
import { getRunningStorm } from "@/server/storm/get-running-storm";

async function BossStormSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]/storm/boss/[domain]">["params"];
}) {
  const { packSlug, domain: domainCode } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/play/${packSlug}/storm/boss/${domainCode}`)}`,
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
  const domain = pack.domains.find((d) => d.code === domainCode);
  if (!domain) notFound();

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name} · Boss Storm
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">
          {domain.code}: {domain.name}
        </h1>
        <p className="mt-2 text-muted-foreground">
          One domain under exam timing.{" "}
          <Link
            href={`/play/${packSlug}/storm/full`}
            className="text-primary underline underline-offset-4"
          >
            Prefer the Full Storm?
          </Link>
        </p>
      </header>
      <StormStart
        packSlug={packSlug}
        kind="boss"
        domainCode={domain.code}
        questionCount={BOSS_STORM_SIZE}
        durationSeconds={stormDurationSeconds(pack.exam, BOSS_STORM_SIZE)}
      />
    </>
  );
}

export default function BossStormPage({
  params,
}: PageProps<"/play/[packSlug]/storm/boss/[domain]">) {
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
        <BossStormSlot params={params} />
      </Suspense>
    </div>
  );
}
