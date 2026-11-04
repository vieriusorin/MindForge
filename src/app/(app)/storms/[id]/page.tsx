import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { Pack } from "@/engine/pack";
import { type Question, toPlayableQuestion } from "@/engine/questions";
import { scoreStorm, stormShortfall } from "@/engine/storm";
import { StormReport } from "@/features/storm/components/storm-report";
import { StormReview } from "@/features/storm/components/storm-review";
import { StormSession } from "@/features/storm/components/storm-session";
import { reviewFeedback } from "@/features/storm/utils/review-feedback";
import { toStormResultRow } from "@/features/storm/utils/storm-result-row";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPack } from "@/server/packs/get-pack";
import { getPackQuestions } from "@/server/questions/get-pack-questions";
import { finalizeExpiredStorms } from "@/server/storm/finalize-expired-storms";
import { getStorm } from "@/server/storm/get-storm";
import { listStormQuestions } from "@/server/storm/list-storm-questions";
import { toStormResult } from "@/server/storm/to-storm-result";
import { toStormSessionQuestion } from "@/server/storm/to-storm-session-question";
import type { StormQuestionRow, StormSummary } from "@/server/storm/types";

interface StormViewProps {
  storm: StormSummary;
  rows: readonly StormQuestionRow[];
  pack: Pack;
  /** null when the question is no longer in the deployed pack files (the DB voids it at finish). */
  questionOf: (id: string) => Question | null;
  /** Deployed-file hash per item: the version this page renders (MF-0013 review). */
  readHashes: Record<string, string>;
  skillNames: Record<string, string>;
}

/** SC-4: a running storm sends only `toStormSessionQuestion` output: no key, no rationale. */
function RunningStorm({
  storm,
  rows,
  questionOf,
  readHashes,
  skillNames,
}: StormViewProps) {
  // A question removed from the deployed files can't be shown or answered; the DB voids it at finish.
  const questions = rows.flatMap((r) => {
    const question = questionOf(r.questionId);
    const readHash = readHashes[r.questionId];
    return question && readHash
      ? [toStormSessionQuestion(question, r, readHash)]
      : [];
  });
  return (
    <StormSession
      stormId={storm.id}
      endsAt={storm.endsAt}
      questions={questions}
      skillNames={skillNames}
    />
  );
}

/** The key and rationales are read from the pack files only here, once the DB has graded. */
function FinishedStorm({
  storm,
  finishedAt,
  rows,
  pack,
  questionOf,
  skillNames,
}: StormViewProps & { finishedAt: string }) {
  const report = scoreStorm(
    pack,
    toStormResult(toStormResultRow(storm, finishedAt, rows)),
  );
  const shortfall = stormShortfall(pack, {
    kind: storm.kind,
    domainCode: storm.domainCode,
    questions: rows,
  });
  const domainNames = Object.fromEntries(
    pack.domains.map((d) => [d.code, d.name]),
  );
  const questionLabels = Object.fromEntries(
    rows.map((r) => [r.questionId, `Question ${r.position}`]),
  );
  // A question removed from the pack since is reported as voided above and left out of the review.
  const items = rows.flatMap((r) => {
    const question = questionOf(r.questionId);
    if (!question) return [];
    return {
      question: toPlayableQuestion(question),
      chosen: r.chosen ?? [],
      correct: r.correct,
      voided: r.voided,
      unreviewed: r.unreviewed,
      feedback: reviewFeedback(question, r.correct),
    };
  });

  return (
    <div className="flex flex-col gap-8">
      <StormReport
        report={report}
        shortfall={shortfall}
        unreviewedIds={rows
          .filter((r) => r.unreviewed)
          .map((r) => r.questionId)}
        domainNames={domainNames}
        skillNames={skillNames}
        questionLabels={questionLabels}
      />
      <div className="flex flex-wrap gap-3">
        <Button asChild>
          <Link href="/today">Back to your forest</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href={`/play/${storm.packSlug}/storm/full`}>
            Start another storm
          </Link>
        </Button>
      </div>
      <StormReview items={items} skillNames={skillNames} />
    </div>
  );
}

async function StormSlot({
  params,
}: {
  params: PageProps<"/storms/[id]">["params"];
}) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/storms/${id}`)}`);

  // MF-0013: a storm past its deadline is graded before it is shown.
  await finalizeExpiredStorms();
  const storm = await getStorm(id);
  if (!storm) notFound();

  const [rows, pack, questions, readHashes] = await Promise.all([
    listStormQuestions(storm.id),
    getPack(storm.packSlug),
    getPackQuestions(storm.packSlug),
    getItemHashes(storm.packSlug),
  ]);
  const byId = new Map(questions.map((q) => [q.id, q]));
  const questionOf = (questionId: string): Question | null =>
    byId.get(questionId) ?? null;
  const skillNames = Object.fromEntries(
    pack.domains.flatMap((d) => d.skills.map((s) => [s.code, s.name])),
  );
  const domain = pack.domains.find((d) => d.code === storm.domainCode);
  const title = domain ? `Boss Storm: ${domain.name}` : "Full Storm";
  const view = { storm, rows, pack, questionOf, readHashes, skillNames };

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name}
          {storm.finishedAt ? " · Storm report" : " · Storm in progress"}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">{title}</h1>
      </header>
      {storm.finishedAt ? (
        <FinishedStorm {...view} finishedAt={storm.finishedAt} />
      ) : (
        <RunningStorm {...view} />
      )}
    </>
  );
}

export default function StormPage({ params }: PageProps<"/storms/[id]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="flex flex-col gap-4" aria-busy="true">
            <Skeleton className="h-10 w-64" />
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        }
      >
        <StormSlot params={params} />
      </Suspense>
    </div>
  );
}
