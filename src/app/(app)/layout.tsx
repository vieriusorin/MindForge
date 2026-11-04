import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  AppSidebar,
  AppSidebarSkeleton,
} from "@/features/app-shell/components/app-sidebar";
import { ModeToggle } from "@/features/app-shell/components/mode-toggle";
import { signOut } from "@/features/auth/actions";
import { getCurrentUser } from "@/server/auth/current-user";
import { listMyGroups } from "@/server/groups/list-my-groups";
import { getPack } from "@/server/packs/get-pack";
import { primaryPackSlug } from "@/server/packs/primary-pack";
import { getDisplayName } from "@/server/profiles/get-display-name";

async function Sidebar() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const [name, groups] = await Promise.all([
    getDisplayName(user.id),
    listMyGroups(user.id),
  ]);
  const packSlug = primaryPackSlug(groups);
  const pack = await getPack(packSlug);
  return (
    <AppSidebar
      displayName={name ?? user.email?.split("@")[0] ?? "Learner"}
      packName={pack.name}
      groups={groups.map((g) => ({ id: g.id, name: g.name }))}
      duelHref={`/play/${packSlug}/duel`}
      walkHref={`/play/${packSlug}/walk`}
      cuckooHref={`/play/${packSlug}/cuckoo`}
      reviewHref={`/review/${packSlug}`}
      signOutAction={signOut}
    />
  );
}

/** Signed-in shell: shadcn Sidebar (inset) in deep indigo + lavender canvas (docs/design/refs/). */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarSkeleton />}>
        <Sidebar />
      </Suspense>
      <SidebarInset>
        <header className="flex h-12 shrink-0 items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="h-4" />
          <span className="flex-1 text-sm text-muted-foreground">
            MindForge
          </span>
          <ModeToggle />
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
