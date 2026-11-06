/**
 * MF-0054 acceptance (frozen, SC-7): the sidebar titles its group section with the label the layout
 * picked ("Pinned" / "Recent") and lists exactly the groups it is given. Without the new prop it
 * renders as before (MF-0052's literal props still compile and render).
 */
import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderWithProviders } from "@/test/render";
import { AppSidebar, type AppSidebarProps } from "..";

vi.mock("next/navigation", () => ({ usePathname: () => "/today" }));

beforeAll(() => {
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

const FOUR = [
  { id: "g1", name: "Alpha" },
  { id: "g2", name: "Bravo" },
  { id: "g3", name: "Charlie" },
  { id: "g4", name: "Delta" },
];

const BASE: AppSidebarProps = {
  displayName: "Ana Steady",
  packName: "Claude Certified Developer",
  groups: FOUR.slice(0, 1),
  duelHref: "/play/ccdv-f/duel",
  walkHref: "/play/ccdv-f/walk",
  cuckooHref: "/play/ccdv-f/cuckoo",
  stormHref: "/play/ccdv-f/storm/full",
  reviewHref: "/review/ccdv-f",
  signOutAction: async () => {},
};

function renderSidebar(props: Partial<AppSidebarProps>) {
  return renderWithProviders(
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar {...BASE} {...props} />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

function groupLinks(): string[] {
  return screen
    .getAllByRole("link")
    .filter((a) => a.getAttribute("href")?.startsWith("/groups/"))
    .map((a) => a.textContent ?? "");
}

describe("MF-0054 SC-7: sidebar group section label", () => {
  it("'Recent' titles the section and the given groups are listed in order", () => {
    renderSidebar({ groupsLabel: "Recent", groups: FOUR.slice(0, 3) });
    expect(screen.getByText("Recent")).toBeInTheDocument();
    expect(screen.queryByText("Pinned")).toBeNull();
    expect(groupLinks()).toEqual(["Alpha", "Bravo", "Charlie"]);
  });

  it("'Pinned' titles the section; the sidebar lists exactly what it is given (the server picked them)", () => {
    renderSidebar({
      groupsLabel: "Pinned",
      groups: [FOUR[3], FOUR[1]].filter((g) => g !== undefined),
    });
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(screen.queryByText("Recent")).toBeNull();
    expect(groupLinks()).toEqual(["Delta", "Bravo"]);
    const delta = screen.getByRole("link", { name: "Delta" });
    expect(delta).toHaveAttribute("href", "/groups/g4");
    expect(within(delta).queryByText("Alpha")).toBeNull();
  });

  it("without groupsLabel it renders as before: 'Pinned' over the given groups", () => {
    renderSidebar({});
    expect(screen.getByText("Pinned")).toBeInTheDocument();
    expect(groupLinks()).toEqual(["Alpha"]);
  });

  it("no groups → no section title at all", () => {
    renderSidebar({ groups: [], groupsLabel: "Recent" });
    expect(screen.queryByText("Recent")).toBeNull();
    expect(screen.queryByText("Pinned")).toBeNull();
  });
});
