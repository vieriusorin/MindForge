import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { playableQuestions } from "@/engine/content";
import { planWalk } from "@/engine/memory";
import { toPlayableQuestion } from "@/engine/questions";
import { WalkSession } from "@/features/walk/components/walk-session";
import { getCurrentUser } from "@/server/auth/current-user";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { getPackQuestions } from "@/server/questions/get-pack-questions";

async function WalkSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]/walk">["params"];
}) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play/${packSlug}/walk`)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, questions, attempts, review] = await Promise.all([
    getPack(packSlug),
    getPackQuestions(packSlug),
    listMyAttempts(user.id, packSlug),
    getReviewContext(user.id, packSlug),
  ]);
  // MF-0009: only candidates are filtered; memory still replays every attempt.
  const plan = planWalk({
    pack,
    questions: playableQuestions(questions, review, "practice"),
    attempts,
    now: new Date(),
  });
  const skillNames = Object.fromEntries(
    pack.domains.flatMap((d) => d.skills.map((s) => [s.code, s.name])),
  );

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Today&apos;s walk</h1>
      </header>
      <WalkSession
        packSlug={packSlug}
        steps={plan.items.map((item) => ({
          question: toPlayableQuestion(item.question),
          reason: item.reason,
        }))}
        skillNames={skillNames}
        todayHref="/today"
        duelHref={`/play/${packSlug}/duel`}
      />
    </>
  );
}

export default function WalkPage({
  params,
}: PageProps<"/play/[packSlug]/walk">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={<p className="text-muted-foreground">Planning your walk…</p>}
      >
        <WalkSlot params={params} />
      </Suspense>
    </div>
  );
}
