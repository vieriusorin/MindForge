import { Route } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { PathProgressSummary } from "@/features/paths/components/path-progress";
import type { PathCardProps } from "./types";

/** MF-0058 SC-8: Today's card for an enrolled path; same figures and Continue as the path page. */
export function PathCard({ slug, name, progress }: PathCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Route aria-hidden className="size-4" />
          <h2>{name}</h2>
        </CardTitle>
        <CardAction>
          <Button asChild variant="link" className="h-10 px-0">
            <Link href={`/paths/${slug}`}>View path</Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        <PathProgressSummary progress={progress} />
      </CardContent>
    </Card>
  );
}
