import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { playableQuestions } from "@/engine/content";
import { buildForest, summarizeForest } from "@/engine/forest";
import { countableAttempts, memoryBySkill, planWalk } from "@/engine/memory";
import { pathProgress } from "@/engine/path";
import { readiness } from "@/engine/readiness";
import { readinessStorms, stormProof } from "@/engine/storm";
import { BlueprintChart } from "@/features/dashboard/components/blueprint-chart";
import { DashboardSkeleton } from "@/features/dashboard/components/dashboard-skeleton";
import { FocusList } from "@/features/dashboard/components/focus-list";
import { GroupsCard } from "@/features/dashboard/components/groups-card";
import { GrowthDonut } from "@/features/dashboard/components/growth-donut";
import { ReadinessCard } from "@/features/dashboard/components/readiness-card";
import { TodayBriefing } from "@/features/dashboard/components/today-briefing";
import { PathCard } from "@/features/paths/components/path-card";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyGroups } from "@/server/groups/list-my-groups";
import { listMyPins } from "@/server/groups/list-my-pins";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { primaryPackSlug } from "@/server/packs/primary-pack";
import { getMyCourseForest } from "@/server/paths/get-my-course-forest";
import { getPathEnrollment } from "@/server/paths/get-path-enrollment";
import { listCourseCompletions } from "@/server/paths/list-course-completions";
import { listPaths } from "@/server/paths/list-paths";
import { getDisplayName } from "@/server/profiles/get-display-name";
import { getPackQuestions } from "@/server/questions/get-pack-questions";
import { finalizeExpiredStorms } from "@/server/storm/finalize-expired-storms";
import { listMyStormResults } from "@/server/storm/list-my-storm-results";

/**
 * MF-0058 SC-8: a Path card per enrolled path, with the same `pathProgress` as the path page. Not
 * enrolled anywhere: nothing renders and no course is replayed.
 */
async function TodayPathCards({ userId, now }: { userId: string; now: Date }) {
  const paths = await listPaths();
  const enrollments = await Promise.all(
    paths.map((path) => getPathEnrollment(userId, path.slug)),
  );
  const enrolled = paths.filter((_, index) => enrollments[index] !== null);
  if (enrolled.length === 0) return null;
  const completions = await listCourseCompletions(userId);
  const cards = await Promise.all(
    enrolled.map(async (path) => {
      const forests = new Map(
        await Promise.all(
          path.courses.map(
            async (packSlug) =>
              [
                packSlug,
                await getMyCourseForest({ userId, packSlug, now }),
              ] as const,
          ),
        ),
      );
      return {
        path,
        progress: pathProgress({ path, completions, forests }),
      };
    }),
  );
  return (
    <div className="mt-6 grid items-start gap-6 lg:grid-cols-2">
      {cards.map(({ path, progress }) => (
        <PathCard
          key={path.slug}
          slug={path.slug}
          name={path.name}
          progress={progress}
        />
      ))}
    </div>
  );
}

async function TodaySlot() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/today");
  const [name, groups, pins, packs] = await Promise.all([
    getDisplayName(user.id),
    listMyGroups(user.id),
    listMyPins(),
    listPacks(),
  ]);
  // MF-0054: the same pack the sidebar plays (the newest pin, else the newest-joined group)
  const packSlug = primaryPackSlug({ groups, pins });
  // MF-0013: storms are graded lazily, so a storm past its deadline counts before we read results.
  await finalizeExpiredStorms();
  const [pack, attempts, questions, review, stormResults] = await Promise.all([
    getPack(packSlug),
    listMyAttempts(user.id, packSlug),
    getPackQuestions(packSlug),
    getReviewContext(user.id, packSlug),
    listMyStormResults(user.id, packSlug),
  ]);
  const now = new Date();
  // MF-0003: the forest is replayed (FSRS) from the learner's DB-graded attempts.
  // MF-0007: only countable ones (not rejected, not spoiled by reviewing), same as every surface.
  const countable = countableAttempts(attempts, review);
  // MF-0013 SC-6: a proving storm lets a skill reach Tree / Ancient Tree.
  const proof = stormProof(stormResults, review.rejected);
  const summary = summarizeForest(
    buildForest(pack, memoryBySkill(countable, now, proof)),
  );
  // MF-0009: the same plan the walk page builds, so the button's count matches the walk.
  const walkPlan = planWalk({
    pack,
    questions: playableQuestions(questions, review, "practice"),
    attempts: countable,
    now,
  });
  // MF-0015: same countable attempts as the forest; MF-0013 (merged second) wires the finished
  // storms' per-domain scores (ROADMAP §4.3).
  const forecast = readiness({
    pack,
    attempts: countable,
    storms: readinessStorms(pack, stormResults),
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

      <Suspense fallback={<Skeleton className="mt-6 h-40 w-full rounded-xl" />}>
        <TodayPathCards userId={user.id} now={now} />
      </Suspense>

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <BlueprintChart domains={summary.domains} />
        <GrowthDonut
          stageCounts={summary.stageCounts}
          grownPercent={summary.grownPercent}
          totalSkills={summary.totalSkills}
        />
        {forecast && <ReadinessCard readiness={forecast} />}
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
