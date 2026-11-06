import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinCard } from "@/features/groups/components/join-card";
import { joinNotice } from "@/features/groups/utils/path-notice";
import { getCurrentUser } from "@/server/auth/current-user";
import { getInvitePreview } from "@/server/groups/get-invite-preview";
import { getPath } from "@/server/paths/get-path";

async function JoinSlot({
  params,
}: {
  params: PageProps<"/join/[code]">["params"];
}) {
  const { code } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(`/join/${code}`)}`);
  // No mutation on GET: joining needs the button (link prefetch must not join anyone).
  const preview = await getInvitePreview(code);
  if (!preview) return <JoinCard status="invalid" />;
  // MF-0059: a path file removed since the group was made shows no notice rather than failing.
  const path = preview.pathSlug ? await getPath(preview.pathSlug) : null;
  return (
    <JoinCard
      status="ready"
      code={code}
      groupName={preview.name}
      notice={path ? joinNotice(path.name) : null}
    />
  );
}

export default function JoinPage({ params }: PageProps<"/join/[code]">) {
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
            <JoinSlot params={params} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
