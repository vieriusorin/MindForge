"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** client-side.md §6: the groups list reads the viewer's groups and pins, so it offers a retry. */
export default function GroupsError({ retry }: { retry: () => void }) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle>Your groups could not load</CardTitle>
          <CardDescription>
            Something went wrong while reading your study groups.
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
