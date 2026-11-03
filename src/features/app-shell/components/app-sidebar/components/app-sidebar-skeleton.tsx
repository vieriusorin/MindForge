"use client";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Skeleton } from "@/components/ui/skeleton";

// Fixed widths: SidebarMenuSkeleton uses Math.random(), which Cache Components rejects in a prerendered fallback.
const WIDTHS = ["w-3/4", "w-2/3", "w-1/2", "w-3/5"] as const;

/** Same footprint as the sidebar while the session and groups stream in. */
export function AppSidebarSkeleton() {
  return (
    <Sidebar variant="inset" collapsible="icon">
      <SidebarHeader>
        <Skeleton className="h-12 rounded-lg bg-sidebar-accent" />
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarMenu className="gap-2">
            {WIDTHS.map((w) => (
              <SidebarMenuItem key={w}>
                <Skeleton className={`h-8 rounded-md bg-sidebar-accent ${w}`} />
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
