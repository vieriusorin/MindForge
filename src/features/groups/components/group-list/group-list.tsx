import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PinToggle } from "@/features/groups/components/pin-toggle";
import { initials } from "@/lib/initials";
import type { GroupListProps } from "./types";

export function GroupList({
  groups,
  packNames,
  pinnedGroupIds,
}: GroupListProps) {
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
        <li key={g.id} className="flex flex-wrap items-center gap-x-2">
          {/* MF-0054: the toggle sits beside the row link; a button inside <a> is invalid */}
          <Link
            href={`/groups/${g.id}`}
            className="block min-w-0 flex-1 rounded-xl"
          >
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
          <PinToggle
            groupId={g.id}
            groupName={g.name}
            isPinned={pinnedGroupIds.includes(g.id)}
          />
        </li>
      ))}
    </ul>
  );
}
