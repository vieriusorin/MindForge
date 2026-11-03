import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { pickSessionQuestions } from "@/engine/memory";
import { toPlayableQuestion } from "@/engine/questions";
import { DuelSession } from "@/features/duel/components/duel-session";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { getPackQuestions } from "@/server/questions/get-pack-questions";

async function DuelSlot({
  params,
}: {
  params: PageProps<"/play/[packSlug]/duel">["params"];
}) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play/${packSlug}/duel`)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, questions, attempts] = await Promise.all([
    getPack(packSlug),
    getPackQuestions(packSlug),
    listMyAttempts(user.id, packSlug),
  ]);
  const session = pickSessionQuestions({
    pack,
    questions,
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
        <h1 className="mt-1 text-3xl md:text-4xl">Scenario Duel</h1>
      </header>
      <DuelSession
        packSlug={packSlug}
        questions={session.map(toPlayableQuestion)}
        skillNames={skillNames}
        backHref="/groups"
      />
    </>
  );
}

export default function DuelPage({
  params,
}: PageProps<"/play/[packSlug]/duel">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <p className="text-muted-foreground">Picking your questions…</p>
        }
      >
        <DuelSlot params={params} />
      </Suspense>
    </div>
  );
}
