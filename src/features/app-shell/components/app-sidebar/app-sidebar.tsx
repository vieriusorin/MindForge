"use client";

import {
  Flower,
  Footprints,
  LayoutGrid,
  LogOut,
  Swords,
  TreePine,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { initials } from "@/lib/initials";
import type { AppSidebarProps } from "./types";
import { isActivePath, pinnedGroups } from "./utils";

export function AppSidebar({
  displayName,
  packName,
  groups,
  duelHref,
  walkHref,
  reviewHref,
  signOutAction,
}: AppSidebarProps) {
  const pathname = usePathname();
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild tooltip="MindForge">
              <Link href="/today">
                <span
                  aria-hidden
                  className="bg-hero size-8 shrink-0 rounded-lg"
                />
                <span className="grid min-w-0 leading-tight">
                  <span className="truncate font-semibold">MindForge</span>
                  <span className="truncate text-xs opacity-70">
                    {packName}
                  </span>
                </span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, "/today")}
                tooltip="Today"
              >
                <Link href="/today">
                  <LayoutGrid />
                  <span>Today</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, "/groups")}
                tooltip="Study groups"
              >
                <Link href="/groups">
                  <Users />
                  <span>Study groups</span>
                </Link>
              </SidebarMenuButton>
              <SidebarMenuBadge>{groups.length}</SidebarMenuBadge>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, "/review")}
                tooltip="Review"
              >
                <Link href={reviewHref}>
                  <Flower />
                  <span>Review</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Play</SidebarGroupLabel>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, duelHref)}
                tooltip="Scenario Duel"
              >
                <Link href={duelHref}>
                  <Swords />
                  <span>Scenario Duel</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <SidebarMenuButton
                asChild
                isActive={isActivePath(pathname, walkHref)}
                tooltip="Daily Walk"
              >
                <Link href={walkHref}>
                  <Footprints />
                  <span>Daily Walk</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>

        {groups.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Pinned</SidebarGroupLabel>
            <SidebarMenu>
              {pinnedGroups(groups).map((g) => (
                <SidebarMenuItem key={g.id}>
                  <SidebarMenuButton
                    asChild
                    size="sm"
                    isActive={isActivePath(pathname, `/groups/${g.id}`)}
                    tooltip={g.name}
                  >
                    <Link href={`/groups/${g.id}`}>
                      <TreePine />
                      <span>{g.name}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-2 p-2 group-data-[collapsible=icon]:p-0">
              <Avatar>
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground">
                  {initials(displayName)}
                </AvatarFallback>
              </Avatar>
              <span className="grid min-w-0 flex-1 leading-tight group-data-[collapsible=icon]:hidden">
                <span className="truncate text-sm font-semibold">
                  {displayName}
                </span>
                <span className="truncate text-xs opacity-70">Learner</span>
              </span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <form action={signOutAction}>
              <SidebarMenuButton type="submit" tooltip="Sign out">
                <LogOut />
                <span>Sign out</span>
              </SidebarMenuButton>
            </form>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
