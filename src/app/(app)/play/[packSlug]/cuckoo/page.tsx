import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { isPlayable, reviewStateOf, toPlayableCuckoo } from "@/engine/content";
import { countableAttempts, pickSessionItems } from "@/engine/memory";
import { CuckooSession } from "@/features/cuckoo/components/cuckoo-session";
import { getCurrentUser } from "@/server/auth/current-user";
import { getItemHashes } from "@/server/content/get-item-hashes";
import { getPackContent } from "@/server/content/get-pack-content";
import { getReviewContext } from "@/server/content/get-review-context";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";
import { listPacks } from "@/server/packs/list-packs";

const BACK = { href: "/today", label: "Back to your forest" };

async function CuckooSlot({ params }: PageProps<"/play/[packSlug]/cuckoo">) {
  const { packSlug } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/play/${packSlug}/cuckoo`)}`);
  if (!(await listPacks()).some((p) => p.slug === packSlug)) notFound();

  const [pack, content, hashes, attempts, review] = await Promise.all([
    getPack(packSlug),
    getPackContent(packSlug),
    getItemHashes(packSlug),
    listMyAttempts(user.id, packSlug),
    getReviewContext(user.id, packSlug),
  ]);
  // Same memory as the forest on /today (countable attempts), same pick rule as the Duel.
  const session = pickSessionItems({
    pack,
    items: content.cuckoos
      .filter((c) =>
        isPlayable(
          reviewStateOf(review, { id: c.id, origin: c.origin }),
          "practice",
        ),
      )
      .map((c) => ({ cuckoo: c, id: c.id, skillCode: c.skill })),
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
        <h1 className="mt-1 text-3xl md:text-4xl">Spot the Cuckoo</h1>
      </header>
      <CuckooSession
        packSlug={packSlug}
        // C-2: only the pre-answer view crosses to the client, bound to the deployed version.
        cuckoos={session.flatMap(({ cuckoo }) => {
          const hash = hashes[cuckoo.id];
          return hash ? [toPlayableCuckoo(cuckoo, hash)] : [];
        })}
        skillNames={skillNames}
        back={BACK}
      />
    </>
  );
}

export default function CuckooPage(
  props: PageProps<"/play/[packSlug]/cuckoo">,
) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={<p className="text-muted-foreground">Finding cuckoos…</p>}
      >
        <CuckooSlot {...props} />
      </Suspense>
    </div>
  );
}
