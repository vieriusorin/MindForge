"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/** MF-0064: the lesson segment's error boundary, with a retry. */
export default function LessonError({ retry }: { retry: () => void }) {
  return (
    <div className="w-full px-4 pb-10 md:px-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl">
            <h2>This lesson could not load</h2>
          </CardTitle>
          <CardDescription>
            Answers you already checked are recorded. Try again.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button onClick={retry}>Try again</Button>
        </CardFooter>
      </Card>
    </div>
  );
}
