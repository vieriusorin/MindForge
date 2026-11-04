import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ReviewActions } from "..";

const { approveItem, flagItem } = vi.hoisted(() => ({
  approveItem: vi.fn(),
  flagItem: vi.fn(),
}));

vi.mock("@/features/review/actions", () => ({ approveItem, flagItem }));

const ITEM = "ccdv-f.D1.S1.q1";
const HASH = "h-q1-v3";

function renderActions() {
  return renderWithProviders(
    <ReviewActions itemId={ITEM} contentHash={HASH} />,
  );
}

describe("ReviewActions", () => {
  beforeEach(() => {
    approveItem.mockReset();
    flagItem.mockReset();
  });

  it("approves the item and keeps both buttons disabled until the next item renders", async () => {
    approveItem.mockResolvedValue({ ok: true });
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    await waitFor(() =>
      expect(approveItem.mock.calls[0]?.[0]).toEqual({
        itemId: ITEM,
        contentHash: HASH,
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Approving…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Flag" })).toBeDisabled();
  });

  it("shows why an approval was refused", async () => {
    approveItem.mockResolvedValue({
      ok: false,
      error: "You can't do this for this item.",
    });
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Approve" }));

    expect(
      await screen.findByText("You can't do this for this item."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Approve" })).toBeEnabled();
  });

  it("refuses a flag without a comment and does not call the action", async () => {
    const { user } = renderActions();

    await user.click(screen.getByRole("button", { name: "Flag" }));

    expect(
      await screen.findByText("Say what is wrong, so a maintainer can fix it."),
    ).toBeVisible();
    expect(screen.getByLabelText("What is wrong?")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(flagItem).not.toHaveBeenCalled();
  });

  it("flags with the trimmed comment", async () => {
    flagItem.mockResolvedValue({ ok: true });
    const { user } = renderActions();

    await user.type(
      screen.getByLabelText("What is wrong?"),
      "  Option C is also correct.  ",
    );
    await user.click(screen.getByRole("button", { name: "Flag" }));

    await waitFor(() =>
      expect(flagItem.mock.calls[0]?.[0]).toEqual({
        itemId: ITEM,
        contentHash: HASH,
        comment: "Option C is also correct.",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Flagging…" }),
    ).toBeDisabled();
  });

  it("says so when the server can't be reached", async () => {
    flagItem.mockRejectedValue(new Error("network"));
    const { user } = renderActions();

    await user.type(screen.getByLabelText("What is wrong?"), "Wrong page.");
    await user.click(screen.getByRole("button", { name: "Flag" }));

    expect(
      await screen.findByText("Could not reach the server. Try again."),
    ).toBeVisible();
  });
});
