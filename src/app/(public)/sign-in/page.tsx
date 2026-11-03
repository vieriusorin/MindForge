import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { SignInForm } from "@/features/auth/components/sign-in-form";
import { safeNextPath } from "@/server/auth/safe-next";

async function SignInSlot({
  searchParams,
}: {
  searchParams: PageProps<"/sign-in">["searchParams"];
}) {
  const params = await searchParams;
  const next = safeNextPath(
    typeof params.next === "string" ? params.next : null,
  );
  return <SignInForm next={next} linkError={params.error === "link"} />;
}

export default function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <div aria-hidden className="bg-backdrop fixed inset-0 -z-10" />
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">Sign in to MindForge</h1>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<p className="text-muted-foreground">Loading…</p>}
          >
            <SignInSlot searchParams={searchParams} />
          </Suspense>
        </CardContent>
      </Card>
    </main>
  );
}
