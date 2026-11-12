import { Flag } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { type ReactNode, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { itemSkillCode, nextReviewItem } from "@/engine/content";
import { ReviewActions } from "@/features/review/components/review-actions";
import { ReviewItem } from "@/features/review/components/review-item";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getPackOrders } from "@/server/content/get-pack-orders";
import { listMyGroups } from "@/server/groups/list-my-groups";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { listOpenFlags } from "@/server/review/list-open-flags";
import { listReviewable } from "@/server/review/list-reviewable";

function PageHeader({
  packName,
  actions,
}: {
  packName: string;
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {packName}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Review</h1>
      </div>
      {actions}
    </header>
  );
}

function Notice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{children}</CardDescription>
      </CardHeader>
    </Card>
  );
}

async function ReviewSlot({
  params,
}: {
  params: PageProps<"/review/[packSlug]">["params"];
}) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/review/${packSlug}`)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, groups] = await Promise.all([
    getPack(packSlug),
    listMyGroups(user.id),
  ]);
  // MF-0007 SC-2: only learners in a group for the pack review it (the database enforces it too).
  if (!groups.some((g) => g.packSlug === packSlug))
    return (
      <>
        <PageHeader packName={pack.name} />
        <Notice title="Join a group first">
          Reviewing is open to learners in a study group for this pack.
        </Notice>
      </>
    );

  const [candidates, content, orders, fileHashes, flags] = await Promise.all([
    listReviewable(packSlug),
    getPackContent(packSlug),
    getPackOrders(packSlug),
    getItemHashes(packSlug),
    listOpenFlags(packSlug),
  ]);
  // MF-0007 review: only an item whose deployed text is the registry's version is shown and judged.
  const next = nextReviewItem(
    candidates,
    pack,
    { ...content, orders },
    fileHashes,
  );
  const skillNames = new Map(
    pack.domains.flatMap((d) => d.skills.map((s) => [s.code, s.name])),
  );
  const nextSkill = next ? itemSkillCode(next.packItem) : "";

  return (
    <>
      <PageHeader
        packName={pack.name}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="secondary">
              <span className="tabular-nums">{candidates.length}</span> in your
              queue
            </Badge>
            {/* listOpenFlags is null for anyone but a content maintainer */}
            {flags && (
              <Button asChild variant="outline">
                <Link href={`/review/${packSlug}/flags`}>
                  <Flag aria-hidden /> Open flags
                  <Badge variant="destructive">
                    <span className="tabular-nums">{flags.length}</span>
                  </Badge>
                </Link>
              </Button>
            )}
          </div>
        }
      />
      {next ? (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ReviewItem
            packItem={next.packItem}
            skillName={skillNames.get(nextSkill) ?? nextSkill}
          />
          <ReviewActions
            key={`${next.packItem.item.id}@${next.contentHash}`}
            itemId={next.packItem.item.id}
            contentHash={next.contentHash}
          />
        </div>
      ) : (
        <Notice title="Nothing left to review">
          You have reviewed every item you didn't write. New items appear here
          when they are added or edited.
        </Notice>
      )}
    </>
  );
}

export default function ReviewPage({
  params,
}: PageProps<"/review/[packSlug]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="grid gap-6">
            <Skeleton className="h-16 w-64" />
            <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <Skeleton className="h-96 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        }
      >
        <ReviewSlot params={params} />
      </Suspense>
    </div>
  );
}
