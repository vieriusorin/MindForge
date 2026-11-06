/**
 * MF-0058 acceptance (SC-9): the sidebar's Workspace group has a **Paths** item, with a tooltip so
 * the icon-only sidebar stays usable (ui-design.md §3). The sidebar takes no new required prop: the
 * MF-0052 / MF-0054 frozen tests keep their literal props. The pin rule itself is proved by those
 * frozen tests staying green unedited.
 */
import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderWithProviders } from "@/test/render";
import { AppSidebar, type AppSidebarProps } from "..";

vi.mock("next/navigation", () => ({ usePathname: () => "/today" }));

beforeAll(() => {
  // jsdom has no matchMedia; the sidebar asks it whether the screen is mobile
  window.matchMedia = (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

const BASE: AppSidebarProps = {
  displayName: "Ana Steady",
  packName: "AI Capabilities and Limitations",
  groups: [{ id: "g1", name: "Demo study group" }],
  duelHref: "/play/ai-capabilities/duel",
  walkHref: "/play/ai-capabilities/walk",
  cuckooHref: "/play/ai-capabilities/cuckoo",
  stormHref: null,
  reviewHref: "/review/ai-capabilities",
  signOutAction: async () => {},
};

function renderSidebar({ isOpen }: { isOpen: boolean }) {
  return renderWithProviders(
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={isOpen}>
        <AppSidebar {...BASE} />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

/** The menu list right under the "Workspace" group label. */
function workspaceMenu(): HTMLElement {
  const label = screen.getByText("Workspace");
  const group = label.parentElement;
  if (!group) throw new Error("Workspace group not found");
  return group;
}

describe("MF-0058 SC-9: a Paths item in the sidebar's Workspace group", () => {
  it("SC-9: Workspace lists a Paths link to the paths area", () => {
    renderSidebar({ isOpen: true });
    const link = within(workspaceMenu()).getByRole("link", { name: "Paths" });
    expect(link.getAttribute("href")).toMatch(/^\/paths(\/|$)/);
  });

  it("SC-9: in the icon-only sidebar, Paths shows a 'Paths' tooltip", async () => {
    const { user } = renderSidebar({ isOpen: false });
    const link = within(workspaceMenu()).getByRole("link", { name: "Paths" });
    await user.hover(link);
    expect(await screen.findByRole("tooltip", { name: "Paths" })).toBeTruthy();
  });
});
