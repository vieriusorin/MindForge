import { redirect } from "next/navigation";
import { Suspense } from "react";
import { buildForest, summarizeForest } from "@/engine/forest";
import { countableAttempts, memoryBySkill } from "@/engine/memory";
import { BlueprintChart } from "@/features/dashboard/components/blueprint-chart";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { FocusList } from "@/features/dashboard/components/focus-list";
import { GroupsCard } from "@/features/dashboard/components/groups-card";
import { GrowthDonut } from "@/features/dashboard/components/growth-donut";
import { TodayBriefing } from "@/features/dashboard/components/today-briefing";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyGroups } from "@/server/groups/list-my-groups";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { primaryPackSlug } from "@/server/packs/primary-pack";
import { getDisplayName } from "@/server/profiles/get-display-name";

async function TodaySlot() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");
  const [name, groups, packs] = await Promise.all([
    getDisplayName(user.id),
    listMyGroups(user.id),
    listPacks(),
  ]);
  const packSlug = primaryPackSlug(groups);
  const [pack, attempts, review] = await Promise.all([
    getPack(packSlug),
    listMyAttempts(user.id, packSlug),
    getReviewContext(user.id, packSlug),
  ]);
  // MF-0003: the forest is replayed (FSRS) from the learner's DB-graded attempts.
  // MF-0007: only countable ones (not rejected, not spoiled by reviewing), same as every surface.
  const summary = summarizeForest(
    buildForest(
      pack,
      memoryBySkill(countableAttempts(attempts, review), new Date()),
    ),
  );
  const packNames = Object.fromEntries(packs.map((p) => [p.slug, p.name]));
  const firstName = (name ?? user.email?.split("@")[0] ?? "there").split(
    " ",
  )[0];
  const top = summary.focus[0];

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Welcome back, {firstName}</h1>
      </header>

      <TodayBriefing
        grownSkills={summary.grownSkills}
        totalSkills={summary.totalSkills}
        grownPercent={summary.grownPercent}
        topFocus={top ? { name: top.name, weight: top.weight } : null}
        exam={pack.exam}
        groupCount={groups.length}
      />

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <BlueprintChart domains={summary.domains} />
        <GrowthDonut
          stageCounts={summary.stageCounts}
          grownPercent={summary.grownPercent}
          totalSkills={summary.totalSkills}
        />
        <FocusList skills={summary.focus} />
        <GroupsCard groups={groups} packNames={packNames} />
      </div>
    </>
  );
}

export default function TodayPage() {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense fallback={<DashboardSkeleton />}>
        <TodaySlot />
      </Suspense>
    </div>
  );
}
