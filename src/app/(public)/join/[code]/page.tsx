import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { joinGroup } from "@/features/groups/actions";
import { JoinCard } from "@/features/groups/components/join-card";
import { getCurrentUser } from "@/server/auth/current-user";

async function JoinSlot({
  params,
  searchParams,
}: {
  params: PageProps<"/join/[code]">["params"];
  searchParams: PageProps<"/join/[code]">["searchParams"];
}) {
  const [{ code }, query] = await Promise.all([params, searchParams]);
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`);
  // No mutation on GET: joining needs the button (link prefetch must not join anyone).
  return (
    <JoinCard
      joinAction={joinGroup.bind(null, code)}
      invalid={query.error === "invalid"}
    />
  );
}

export default function JoinPage({
  params,
  searchParams,
}: PageProps<"/join/[code]">) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <div aria-hidden className="bg-backdrop fixed inset-0 -z-10" />
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Join a study group</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<p className="text-muted-foreground">Loading…</p>}
          >
            <JoinSlot params={params} searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
