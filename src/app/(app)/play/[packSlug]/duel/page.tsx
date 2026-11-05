import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isPlayable, reviewStateOf } from "@/engine/content";
import { countableAttempts, pickSessionQuestions } from "@/engine/memory";
import { toPlayableQuestions } from "@/engine/questions";
import { DuelSession } from "@/features/duel/components/duel-session";
import { loadDuelParams } from "@/features/duel/search-params";
import { duelBackLink } from "@/features/duel/utils/back-link";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { getPackQuestions } from "@/server/questions/get-pack-questions";

async function DuelSlot({
  params,
  searchParams,
}: PageProps<"/play/[packSlug]/duel">) {
  const [{ packSlug }, { from }] = await Promise.all([
    params,
    loadDuelParams(searchParams),
  ]);
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play/${packSlug}/duel`)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, questions, hashes, attempts, review] = await Promise.all([
    getPack(packSlug),
    getPackQuestions(packSlug),
    getItemHashes(packSlug),
    listMyAttempts(user.id, packSlug),
    getReviewContext(user.id, packSlug),
  ]);
  // MF-0007: memory replays the same countable attempts as the forest on /today and the group.
  const session = pickSessionQuestions({
    pack,
    questions: questions.filter((q) =>
      isPlayable(reviewStateOf(review, q), "practice"),
    ),
    attempts: countableAttempts(attempts, review),
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
        <h1 className="mt-1 text-3xl md:text-4xl">Scenario Duel</h1>
      </header>
      <DuelSession
        packSlug={packSlug}
        // MF-0032: each question carries the version this page shows; the answer sends it back.
        questions={toPlayableQuestions(session, hashes)}
        skillNames={skillNames}
        back={duelBackLink(from)}
      />
    </>
  );
}

export default function DuelPage(props: PageProps<"/play/[packSlug]/duel">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <p className="text-muted-foreground">Picking your questions…</p>
        }
      >
        <DuelSlot {...props} />
      </Suspense>
    </div>
  );
}
