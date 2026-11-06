import { redirect } from "next/navigation";
import { Suspense } from "react";
import { CreateGroupForm } from "@/features/groups/components/create-group-form";
import { GroupList } from "@/features/groups/components/group-list";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMyGroups } from "@/server/groups/list-my-groups";
import { listMyPins } from "@/server/groups/list-my-pins";
import { listPacks } from "@/server/packs/list-packs";

async function GroupsSlot() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in?next=/groups");
  const [groups, pins, packs] = await Promise.all([
    listMyGroups(user.id),
    listMyPins(),
    listPacks(),
  ]);
  const packNames = Object.fromEntries(packs.map((p) => [p.slug, p.name]));
  return (
    <div className="grid gap-6 md:grid-cols-[1fr_20rem]">
      <GroupList
        groups={groups}
        packNames={packNames}
        pinnedGroupIds={pins.map((p) => p.groupId)}
      />
      <CreateGroupForm packs={packs} />
    </div>
  );
}

export default function GroupsPage() {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <h1 className="mb-6 text-4xl">My study groups</h1>
      <Suspense
        fallback={<p className="text-muted-foreground">Loading your groups…</p>}
      >
        <GroupsSlot />
      </Suspense>
    </div>
  );
}
