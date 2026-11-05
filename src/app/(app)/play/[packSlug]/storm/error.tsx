"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** client-side.md §6: the storm start pages read the learner's own forest (MF-0013), so they offer a retry. */
export default function StormStartError({ retry }: { retry: () => void }) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle>The storm could not be prepared</CardTitle>
          <CardDescription>
            Something went wrong while reading your progress.
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
