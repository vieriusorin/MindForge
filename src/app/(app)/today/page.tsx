import { redirect } from "next/navigation";
import { Suspense } from "react";
import { playableQuestions } from "@/engine/content";
import { buildForest, summarizeForest } from "@/engine/forest";
import { memoryBySkill, planWalk } from "@/engine/memory";
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
import { getPackQuestions } from "@/server/questions/get-pack-questions";

async function TodaySlot() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");
  const [name, groups, packs] = await Promise.all([
    getDisplayName(user.id),
    listMyGroups(user.id),
    listPacks(),
  ]);
  const packSlug = primaryPackSlug(groups);
  const [pack, attempts, questions, review] = await Promise.all([
    getPack(packSlug),
    listMyAttempts(user.id, packSlug),
    getPackQuestions(packSlug),
    getReviewContext(user.id, packSlug),
  ]);
  const now = new Date();
  // MF-0003: the forest is replayed (FSRS) from the learner's DB-graded attempts.
  const summary = summarizeForest(
    buildForest(pack, memoryBySkill(attempts, now)),
  );
  // MF-0009: the same plan the walk page builds, so the button's count matches the walk.
  const walkPlan = planWalk({
    pack,
    questions: playableQuestions(questions, review, "practice"),
    attempts,
    now,
  });
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
        walk={
          walkPlan.items.length === 0
            ? { isHealthy: true, duelHref: `/play/${packSlug}/duel` }
            : {
                isHealthy: false,
                needWaterCount: walkPlan.needWaterCount,
                stepCount: walkPlan.items.length,
                href: `/play/${packSlug}/walk`,
              }
        }
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
