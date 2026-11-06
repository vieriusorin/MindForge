"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** MF-0058: the paths segment's error boundary (client-side.md §6), with a retry. */
export default function PathsError({ retry }: { retry: () => void }) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2>This path could not load</h2>
          </CardTitle>
          <CardDescription>Your progress is safe. Try again.</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={retry}>Try again</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
