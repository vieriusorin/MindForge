import { redirect } from "next/navigation";
import { Suspense } from "react";
import { Card, CardDescription, CardHeader } from "@/components/ui/card";
import { buildForest } from "@/engine/forest";
import { Forest } from "@/features/forest/components/forest";
import { getCurrentUser } from "@/server/auth/current-user";
import { getPack } from "@/server/packs/get-pack";

import { DEFAULT_PACK_SLUG as DEFAULT_PACK } from "@/server/packs/primary-pack";

/** Signed-in learners belong on their dashboard, not the public preview. */
async function SignedInRedirect() {
  if (await getCurrentUser()) redirect("/today");
  return null;
}

export default async function Home() {
  const pack = await getPack(DEFAULT_PACK);
  const forest = buildForest(pack);

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-8">
      <Suspense fallback={null}>
        <SignedInRedirect />
      </Suspense>
      <Card className="bg-hero mb-8 ring-0">
        <CardHeader className="px-6 md:px-8">
          <CardDescription className="text-xs font-medium tracking-wider text-white/70 uppercase">
            MindForge · Knowledge Forest
          </CardDescription>
          <h1 className="text-3xl text-white md:text-4xl">{forest.packName}</h1>
        </CardHeader>
      </Card>
      <Forest forest={forest} />
    </main>
  );
}
