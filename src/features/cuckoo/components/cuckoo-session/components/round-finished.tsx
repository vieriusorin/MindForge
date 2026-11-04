import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { RoundFinishedProps } from "../types";

/** MF-0016: the end of a round. */
export function RoundFinished({
  score,
  answered,
  back,
  doneRef,
}: RoundFinishedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl">
          <h2 ref={doneRef} tabIndex={-1}>
            Round finished: <span className="tabular-nums">{score}</span> /{" "}
            <span className="tabular-nums">{answered}</span> cuckoos spotted
          </h2>
        </CardTitle>
        <CardDescription>
          Trees grow only from what you spotted correctly. Come back tomorrow
          for a new round.
        </CardDescription>
      </CardHeader>
      <CardFooter>
        <Button asChild>
          <Link href={back.href}>{back.label}</Link>
        </Button>
      </CardFooter>
    </Card>
  );
}
