import { ChevronRight, Route } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  completeLine,
  courseCountLabel,
} from "@/features/paths/utils/path-display";
import type { PathListProps } from "./types";

/** MF-0058: every path, each row linking to its page. */
export function PathList({ paths }: PathListProps) {
  if (paths.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground">
          No paths yet.
        </CardContent>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {paths.map((path) => (
        <li key={path.slug}>
          <Link href={`/paths/${path.slug}`} className="block rounded-xl">
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-3">
                <Avatar size="lg" className="rounded-lg">
                  <AvatarFallback className="bg-hero rounded-lg text-white">
                    <Route aria-hidden className="size-5" />
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{path.name}</span>
                  <span className="truncate text-xs text-muted-foreground tabular-nums">
                    {`${courseCountLabel(path.progress.total)} · ${completeLine(path.progress)}`}
                  </span>
                </span>
                {path.isEnrolled && <Badge variant="secondary">Enrolled</Badge>}
                <ChevronRight
                  aria-hidden
                  className="size-4 text-muted-foreground"
                />
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
