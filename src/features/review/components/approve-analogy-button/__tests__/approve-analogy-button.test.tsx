import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ApproveAnalogyButton } from "..";

const { approveAnalogy } = vi.hoisted(() => ({ approveAnalogy: vi.fn() }));

vi.mock("@/features/review/actions", () => ({ approveAnalogy }));

const CARD = "ccdv-f.D5.S1.card-temperature";
const HASH = "h-card-v1";

describe("ApproveAnalogyButton", () => {
  beforeEach(() => approveAnalogy.mockReset());

  it("is disabled, with the reason, before the caller may approve", () => {
    renderWithProviders(
      <ApproveAnalogyButton
        itemId={CARD}
        contentHash={HASH}
        canApprove={false}
      />,
    );
    expect(
      screen.getByRole("button", { name: "Approve analogy" }),
    ).toBeDisabled();
    expect(screen.getByText(/any maintainer may after 48 hours/)).toBeVisible();
  });

  it("approves and stays disabled until the list re-renders", async () => {
    approveAnalogy.mockResolvedValue({ ok: true });
    const { user } = renderWithProviders(
      <ApproveAnalogyButton itemId={CARD} contentHash={HASH} canApprove />,
    );

    await user.click(screen.getByRole("button", { name: "Approve analogy" }));

    await waitFor(() =>
      expect(approveAnalogy.mock.calls[0]?.[0]).toEqual({
        itemId: CARD,
        contentHash: HASH,
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Approving…" }),
    ).toBeDisabled();
  });

  it("announces a refusal", async () => {
    approveAnalogy.mockResolvedValue({
      ok: false,
      error: "You can't do this for this item.",
    });
    const { user } = renderWithProviders(
      <ApproveAnalogyButton itemId={CARD} contentHash={HASH} canApprove />,
    );

    await user.click(screen.getByRole("button", { name: "Approve analogy" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You can't do this for this item.",
    );
  });
});
