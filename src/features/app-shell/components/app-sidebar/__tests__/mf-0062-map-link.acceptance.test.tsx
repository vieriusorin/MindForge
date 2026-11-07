/**
 * MF-0062 acceptance (SC-7, sidebar half): the Play group has a **Course map** item for the primary
 * pack when the layout passes `mapHref`, with a tooltip for the icon-only sidebar (ui-design.md §3).
 * `mapHref` is optional, so the MF-0052 / MF-0054 / MF-0058 frozen tests keep their literal props.
 */
import { screen, within } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderWithProviders } from "@/test/render";
import { AppSidebar, type AppSidebarProps } from "..";

vi.mock("next/navigation", () => ({ usePathname: () => "/play/ccdv-f" }));

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
  packName: "Claude Certified Developer",
  groups: [],
  duelHref: "/play/ccdv-f/duel",
  walkHref: "/play/ccdv-f/walk",
  cuckooHref: "/play/ccdv-f/cuckoo",
  stormHref: "/play/ccdv-f/storm/full",
  reviewHref: "/review/ccdv-f",
  signOutAction: async () => {},
};

function renderSidebar(props: AppSidebarProps, isOpen: boolean) {
  return renderWithProviders(
    <TooltipProvider delayDuration={0}>
      <SidebarProvider defaultOpen={isOpen}>
        <AppSidebar {...props} />
      </SidebarProvider>
    </TooltipProvider>,
  );
}

function playMenu(): HTMLElement {
  const group = screen.getByText("Play").parentElement;
  if (!group) throw new Error("Play group not found");
  return group;
}

describe("MF-0062 SC-7: a Course map item in the sidebar's Play group", () => {
  it("SC-7: Play lists Course map first, linking to the primary pack's map, current on that page", () => {
    renderSidebar({ ...BASE, mapHref: "/play/ccdv-f" }, true);
    const links = within(playMenu()).getAllByRole("link");
    expect(links[0]?.textContent).toBe("Course map");
    expect(links[0]?.getAttribute("href")).toBe("/play/ccdv-f");
    expect(links[0]?.getAttribute("data-active")).toBe("true");
  });

  it("SC-7: on the map page, Course map is the only current Play item", () => {
    renderSidebar({ ...BASE, mapHref: "/play/ccdv-f" }, true);
    const active = within(playMenu())
      .getAllByRole("link")
      .filter((a) => a.getAttribute("data-active") === "true")
      .map((a) => a.textContent);
    expect(active).toEqual(["Course map"]);
  });

  it("SC-7: in the icon-only sidebar, Course map shows a tooltip", async () => {
    const { user } = renderSidebar({ ...BASE, mapHref: "/play/ccdv-f" }, false);
    const link = within(playMenu()).getByRole("link", { name: "Course map" });
    await user.hover(link);
    expect(
      await screen.findByRole("tooltip", { name: "Course map" }),
    ).toBeTruthy();
  });

  it("SC-7: without mapHref the Play group has no Course map item", () => {
    renderSidebar(BASE, true);
    expect(
      within(playMenu()).queryByRole("link", { name: "Course map" }),
    ).toBeNull();
  });
});
