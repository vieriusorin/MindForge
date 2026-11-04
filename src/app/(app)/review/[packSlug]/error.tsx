"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** client-side.md §6: the review segment does per-user work, so it offers a retry. */
export default function ReviewError({ retry }: { retry: () => void }) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Review could not load</CardTitle>
          <CardDescription>
            Something went wrong while reading the review queue.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Button type="button" onClick={retry}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
