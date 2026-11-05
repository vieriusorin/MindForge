import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { StormUnavailableProps } from "./types";

/** MF-0052 SC-2: a Storm page for a pack without an `exam:` block explains why, instead of a 404. */
export function StormUnavailable({
  packName,
  duelHref,
}: StormUnavailableProps) {
  return (
    <>
      <header className="mb-6">
        <p className="text-xs font-medium tracking-wider text-muted-foreground uppercase">
          {packName}
        </p>
        <h1 className="mt-1 text-3xl md:text-4xl">Storm</h1>
      </header>
      <Card>
        <CardHeader>
          <CardTitle>
            <h2>This pack has no mock exam</h2>
          </CardTitle>
          <CardDescription>
            A Storm is a timed mock exam built from a pack&apos;s exam
            blueprint. {packName} has none, so there is no Storm to take.
            Practise its scenarios in Scenario Duel instead.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button asChild>
            <Link href={duelHref}>Go to Scenario Duel</Link>
          </Button>
        </CardFooter>
      </Card>
    </>
  );
}
