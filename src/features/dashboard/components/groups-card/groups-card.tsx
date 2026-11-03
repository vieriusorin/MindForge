import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { initials } from "@/lib/initials";
import type { GroupsCardProps } from "./types";

export function GroupsCard({ groups, packNames }: GroupsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Study groups</CardTitle>
        <CardDescription>Learn together</CardDescription>
        <CardAction>
          <Button variant="link" size="sm" asChild>
            <Link href="/groups">
              {groups.length === 0 ? "Start one" : "View all"}
              <ChevronRight data-icon="inline-end" />
            </Link>
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent>
        {groups.length === 0 ? (
          <p className="text-muted-foreground">
            Start a group or open an invite link from a colleague.
          </p>
        ) : (
          <ul className="flex flex-col gap-1">
            {groups.slice(0, 4).map((g) => (
              <li key={g.id}>
                <Button
                  variant="ghost"
                  asChild
                  className="h-auto w-full justify-start gap-3 px-2 py-2"
                >
                  <Link href={`/groups/${g.id}`}>
                    <Avatar className="rounded-lg">
                      <AvatarFallback className="bg-hero rounded-lg text-white">
                        {initials(g.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="grid min-w-0 flex-1 text-left">
                      <span className="truncate font-medium">{g.name}</span>
                      <span className="truncate text-xs text-muted-foreground">
                        {packNames[g.packSlug] ?? g.packSlug}
                      </span>
                    </span>
                    <Badge variant="outline">{g.role}</Badge>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
