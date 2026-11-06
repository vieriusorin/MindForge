import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { EndExpeditionButton } from "..";

const { refresh, endExpedition } = vi.hoisted(() => ({
  refresh: vi.fn(),
  endExpedition: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/expeditions/actions", () => ({ endExpedition }));

const GROUP_ID = "7b0f0c1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f";

function renderButton() {
  return renderWithProviders(<EndExpeditionButton groupId={GROUP_ID} />);
}

async function confirmEnd(user: ReturnType<typeof renderButton>["user"]) {
  await user.click(screen.getByRole("button", { name: "End expedition" }));
  const dialog = await screen.findByRole("alertdialog");
  expect(dialog).toHaveTextContent("End the expedition?");
  expect(dialog).toHaveTextContent(
    "Progress stops counting now. You can start a new one afterwards.",
  );
  await user.click(screen.getByRole("button", { name: "End expedition" }));
}

describe("EndExpeditionButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    endExpedition.mockReset();
  });

  it("asks first, then ends the expedition and refreshes the page", async () => {
    endExpedition.mockResolvedValue({ ok: true });
    const { user } = renderButton();

    await confirmEnd(user);

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(endExpedition).toHaveBeenCalledTimes(1);
    expect(endExpedition.mock.calls[0]?.[0]).toEqual({ groupId: GROUP_ID });
  });

  it("does nothing when the admin cancels", async () => {
    const { user } = renderButton();

    await user.click(screen.getByRole("button", { name: "End expedition" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));

    expect(endExpedition).not.toHaveBeenCalled();
  });

  it("shows the server's reason when ending is refused", async () => {
    endExpedition.mockResolvedValue({
      ok: false,
      error: "No expedition is running.",
    });
    const { user } = renderButton();

    await confirmEnd(user);

    expect(await screen.findByText("No expedition is running.")).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("says so when the server can't be reached", async () => {
    endExpedition.mockRejectedValue(new Error("network"));
    const { user } = renderButton();

    await confirmEnd(user);

    expect(
      await screen.findByText("Could not reach the server. Try again."),
    ).toBeVisible();
  });

  it("is disabled while ending", async () => {
    endExpedition.mockReturnValue(new Promise(() => {}));
    const { user } = renderButton();
    const trigger = screen.getByRole("button", { name: "End expedition" });

    await confirmEnd(user);

    await waitFor(() => expect(trigger).toBeDisabled());
    expect(trigger).toHaveTextContent("Ending…");
  });
});
