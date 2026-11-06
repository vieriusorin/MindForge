"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** client-side.md §6: the join page reads the invite per user (MF-0059), so it offers a retry. */
export default function JoinError({ retry }: { retry: () => void }) {
  return (
    <main className="flex flex-1 items-start justify-center px-4 py-16">
      <div aria-hidden className="bg-backdrop fixed inset-0 -z-10" />
      <Card className="w-full max-w-sm shadow-xl">
        <CardHeader>
          <CardTitle>
            <h1 className="text-2xl">The invite could not load</h1>
          </CardTitle>
          <CardDescription>
            Something went wrong while reading the invite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={retry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
