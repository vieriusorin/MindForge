import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { initials } from "@/lib/initials";
import type { GroupListProps } from "./types";

export function GroupList({ groups, packNames }: GroupListProps) {
  if (groups.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground">
          You&apos;re not in a group yet. Start one, or open an invite link from
          a colleague.
        </CardContent>
      </Card>
    );
  }
  return (
    <ul className="flex flex-col gap-3">
      {groups.map((g) => (
        <li key={g.id}>
          <Link href={`/groups/${g.id}`} className="block rounded-xl">
            <Card className="transition-colors hover:bg-accent">
              <CardContent className="flex items-center gap-3">
                <Avatar size="lg" className="rounded-lg">
                  <AvatarFallback className="bg-hero rounded-lg text-white">
                    {initials(g.name)}
                  </AvatarFallback>
                </Avatar>
                <span className="grid min-w-0 flex-1">
                  <span className="truncate font-medium">{g.name}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {packNames[g.packSlug] ?? g.packSlug}
                  </span>
                </span>
                <Badge variant="outline">{g.role}</Badge>
                <ChevronRight className="size-4 text-muted-foreground" />
              </CardContent>
            </Card>
          </Link>
        </li>
      ))}
    </ul>
  );
}
