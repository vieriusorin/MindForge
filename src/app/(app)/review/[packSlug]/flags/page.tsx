import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { itemTitles } from "@/engine/content";
import { FlagQueue } from "@/features/review/components/flag-queue";
import { PendingAnalogyList } from "@/features/review/components/pending-analogy-list";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";
import { listOpenFlags } from "@/server/review/list-open-flags";
import { listPendingAnalogies } from "@/server/review/list-pending-analogies";

async function FlagsSlot({
  params,
}: {
  params: PageProps<"/review/[packSlug]/flags">["params"];
}) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(
      `/sign-in?next=${encodeURIComponent(`/review/${packSlug}/flags`)}`,
    );
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, content, contentHashes, flags, analogies] = await Promise.all([
    getPack(packSlug),
    getPackContent(packSlug),
    getItemHashes(packSlug),
    listOpenFlags(packSlug),
    listPendingAnalogies(packSlug),
  ]);
  // MF-0007: maintainers only. The database refuses everyone else, so for them the page doesn't exist.
  if (!flags || !analogies) notFound();
  const titles = itemTitles(content);

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
            {pack.name} · Content maintainers
          </p>
          <h1 className="mt-1 text-3xl md:text-4xl">Open flags</h1>
        </div>
        <Button asChild variant="outline">
          <Link href={`/review/${packSlug}`}>
            <ArrowLeft aria-hidden /> Back to review
          </Link>
        </Button>
      </header>
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_24rem]">
        <FlagQueue
          flags={flags}
          titles={titles}
          contentHashes={contentHashes}
        />
        <PendingAnalogyList
          analogies={analogies}
          titles={titles}
          contentHashes={contentHashes}
        />
      </div>
    </>
  );
}

export default function FlagsPage({
  params,
}: PageProps<"/review/[packSlug]/flags">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={
          <div className="grid gap-6">
            <Skeleton className="h-16 w-64" />
            <Skeleton className="h-96 w-full" />
          </div>
        }
      >
        <FlagsSlot params={params} />
      </Suspense>
    </div>
  );
}
