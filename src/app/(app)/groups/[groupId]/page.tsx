import { Swords } from "lucide-react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Button } from "@/components/ui/button";
import { buildForest } from "@/engine/forest";
import { memoryBySkill } from "@/engine/memory";
import { Forest } from "@/features/forest/components/forest";
import { rotateInviteCode } from "@/features/groups/actions";
import { InviteLink } from "@/features/groups/components/invite-link";
import { MemberList } from "@/features/groups/components/member-list";
import { getCurrentUser } from "@/server/auth/current-user";
import { getGroup } from "@/server/groups/get-group";
import { listMembers } from "@/server/groups/list-members";
import { requestOrigin } from "@/server/http/request-origin";
import { listMyAttempts } from "@/server/memory/list-my-attempts";
import { getPack } from "@/server/packs/get-pack";

async function GroupSlot({
  params,
}: {
  params: PageProps<"/groups/[groupId]">["params"];
}) {
  const { groupId } = await params;
  const user = await getCurrentUser();
  if (!user)
    redirect(`/sign-in?next=${encodeURIComponent(`/groups/${groupId}`)}`);
  const group = await getGroup(groupId);
  if (!group) notFound();

  const [members, pack, origin, attempts] = await Promise.all([
    listMembers(group.id),
    getPack(group.packSlug),
    requestOrigin(),
    listMyAttempts(user.id, group.packSlug),
  ]);
  // MF-0003: the signed-in learner's own forest, replayed from DB-graded attempts.
  const forest = buildForest(pack, memoryBySkill(attempts, new Date()));
  const isAdmin = members.some(
    (m) => m.userId === user.id && m.role === "admin",
  );

  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {pack.name}
        </p>
        <h1 className="mt-1 text-4xl">{group.name}</h1>
      </header>
      <div className="mb-8 grid gap-6 md:grid-cols-2">
        <MemberList members={members} currentUserId={user.id} />
        <InviteLink
          inviteUrl={`${origin}/join/${group.inviteCode}`}
          canRotate={isAdmin}
          rotateAction={rotateInviteCode.bind(null, group.id)}
        />
      </div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl">Your forest</h2>
        <Button asChild>
          <Link href={`/play/${group.packSlug}/duel`}>
            <Swords aria-hidden /> Play Scenario Duel
          </Link>
        </Button>
      </div>
      <Forest forest={forest} />
    </>
  );
}

export default function GroupPage({ params }: PageProps<"/groups/[groupId]">) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Suspense
        fallback={<p className="text-muted-foreground">Loading the group…</p>}
      >
        <GroupSlot params={params} />
      </Suspense>
    </div>
  );
}
