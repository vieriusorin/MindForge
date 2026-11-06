/**
 * MF-0054 acceptance (frozen, SC-6): the pin toggle. One test per user-visible outcome: pin, unpin,
 * eviction message, failure, pending. Mocked at the facades: the router and the Server Actions.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { renderWithProviders } from "@/test/render";
import { PinToggle } from "..";

const { refresh, pinGroup, unpinGroup } = vi.hoisted(() => ({
  refresh: vi.fn(),
  pinGroup: vi.fn(),
  unpinGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh, push: vi.fn() }),
}));
vi.mock("@/features/groups/actions", () => ({ pinGroup, unpinGroup }));

const GROUP_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const NAME = "Morning crew";

function renderToggle(isPinned: boolean) {
  return renderWithProviders(
    <TooltipProvider>
      <PinToggle groupId={GROUP_ID} groupName={NAME} isPinned={isPinned} />
    </TooltipProvider>,
  );
}

const button = () =>
  screen.getByRole("button", { name: "Pin Morning crew to sidebar" });

beforeEach(() => {
  refresh.mockReset();
  pinGroup.mockReset();
  unpinGroup.mockReset();
});

describe("MF-0054 SC-6: PinToggle", () => {
  it("names the group and reports its state with aria-pressed", () => {
    renderToggle(false);
    expect(button()).toHaveAttribute("aria-pressed", "false");
  });

  it("pinning calls pinGroup with the id, then refreshes the screen", async () => {
    pinGroup.mockResolvedValue({ ok: true, evicted: null });
    const { user } = renderToggle(false);

    await user.click(button());

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(pinGroup).toHaveBeenCalledWith(GROUP_ID);
    expect(unpinGroup).not.toHaveBeenCalled();
    expect(screen.queryByRole("status")?.textContent ?? "").not.toMatch(
      /unpinned/i,
    );
  });

  it("a pinned group's toggle is pressed, and clicking it unpins", async () => {
    unpinGroup.mockResolvedValue({ ok: true });
    const { user } = renderToggle(true);
    expect(button()).toHaveAttribute("aria-pressed", "true");

    await user.click(button());

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(unpinGroup).toHaveBeenCalledWith(GROUP_ID);
    expect(pinGroup).not.toHaveBeenCalled();
  });

  it("when a pin replaced another, a status message names the unpinned group", async () => {
    pinGroup.mockResolvedValue({
      ok: true,
      evicted: {
        id: "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d",
        name: "Night owls",
      },
    });
    const { user } = renderToggle(false);

    await user.click(button());

    const status = await screen.findByRole("status");
    await waitFor(() => expect(status).toHaveTextContent("Night owls"));
  });

  it("a failure shows its error and does not refresh", async () => {
    pinGroup.mockResolvedValue({
      ok: false,
      error: "You can only pin groups you belong to.",
    });
    const { user } = renderToggle(false);

    await user.click(button());

    expect(
      await screen.findByText("You can only pin groups you belong to."),
    ).toBeInTheDocument();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("while the write is pending, the toggle is disabled", async () => {
    pinGroup.mockReturnValue(new Promise(() => {}));
    const { user } = renderToggle(false);

    await user.click(button());

    await waitFor(() => expect(button()).toBeDisabled());
  });
});
