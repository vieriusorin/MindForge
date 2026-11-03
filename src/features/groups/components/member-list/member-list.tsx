import {
  Avatar,
  AvatarBadge,
  AvatarFallback,
  AvatarGroup,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { initials } from "@/lib/initials";
import type { MemberListProps } from "./types";

/** Members as an avatar group; names live in the tooltip and the accessible label. */
export function MemberList({ members, currentUserId }: MemberListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Members <Badge variant="secondary">{members.length}</Badge>
        </CardTitle>
        <CardDescription>Hover an avatar to see who it is</CardDescription>
      </CardHeader>
      <CardContent>
        <AvatarGroup>
          {members.map((m) => {
            const label = `${m.displayName}${m.userId === currentUserId ? " (you)" : ""}${m.role === "admin" ? " · admin" : ""}`;
            return (
              <Tooltip key={m.userId}>
                <TooltipTrigger asChild>
                  <Avatar
                    size="lg"
                    tabIndex={0}
                    aria-label={label}
                    data-role={m.role}
                  >
                    <AvatarFallback className="bg-hero text-white">
                      {initials(m.displayName)}
                    </AvatarFallback>
                    {m.role === "admin" && <AvatarBadge />}
                  </Avatar>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            );
          })}
        </AvatarGroup>
      </CardContent>
    </Card>
  );
}
