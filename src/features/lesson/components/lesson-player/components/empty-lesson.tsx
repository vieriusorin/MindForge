import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { EmptyLessonProps } from "../types";

/** A skill with no card, diagram or playable question yet. */
export function EmptyLesson({ mapHref }: EmptyLessonProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h2>Nothing to learn here yet</h2>
        </CardTitle>
        <CardDescription>
          This skill has no nature card, diagram or question to play yet.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild variant="outline" className="min-h-10">
          <Link href={mapHref}>Back to course map</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
