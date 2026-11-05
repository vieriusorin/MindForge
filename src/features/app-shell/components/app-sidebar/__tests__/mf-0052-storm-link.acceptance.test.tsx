/**
 * MF-0052 acceptance (frozen, SC-2): the sidebar offers Storm only when the primary pack has an exam.
 * The layout passes `stormHref={null}` for a pack without an `exam:` block; every other link stays.
 */
import { screen } from "@testing-library/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderWithProviders } from "@/test/render";
import { AppSidebar, type AppSidebarProps } from "..";

vi.mock("next/navigation", () => ({ usePathname: () => "/today" }));

beforeAll(() => {
  // jsdom has no matchMedia; the sidebar asks it whether the screen is mobile
  window.matchMedia ??= (query: string) =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList;
});

const BASE: AppSidebarProps = {
  displayName: "Ana Steady",
  packName: "Production-Grade Prompting",
  groups: [{ id: "g1", name: "Demo study group" }],
  duelHref: "/play/prod-prompting/duel",
  walkHref: "/play/prod-prompting/walk",
  cuckooHref: "/play/prod-prompting/cuckoo",
  stormHref: "/play/prod-prompting/storm/full",
  reviewHref: "/review/prod-prompting",
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

describe("MF-0052 SC-2: Storm link only for a pack with an exam", () => {
  it("with a storm href, the sidebar links Storm to it", () => {
    renderSidebar({ stormHref: "/play/ccdv-f/storm/full" });
    expect(screen.getByRole("link", { name: "Storm" })).toHaveAttribute(
      "href",
      "/play/ccdv-f/storm/full",
    );
  });

  it("with stormHref null, there is no Storm item and every other link remains", () => {
    renderSidebar({ stormHref: null });
    // the item is gone, not a dead entry: no link, and no "Storm" label anywhere in the sidebar
    expect(screen.queryByRole("link", { name: "Storm" })).toBeNull();
    expect(screen.queryByText("Storm")).toBeNull();
    for (const [name, href] of [
      ["Today", "/today"],
      ["Study groups", "/groups"],
      ["Review", "/review/prod-prompting"],
      ["Scenario Duel", "/play/prod-prompting/duel"],
      ["Daily Walk", "/play/prod-prompting/walk"],
      ["Spot the Cuckoo", "/play/prod-prompting/cuckoo"],
    ] as const)
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", href);
  });
});
