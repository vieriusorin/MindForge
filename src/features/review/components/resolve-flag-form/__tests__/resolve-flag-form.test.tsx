import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ResolveFlagForm } from "..";

const { resolveFlags } = vi.hoisted(() => ({ resolveFlags: vi.fn() }));

vi.mock("@/features/review/actions", () => ({ resolveFlags }));

const ITEM = "ccdv-f.D1.S1.q2";
const HASH = "h-q2-v1";
const LABEL = "Your decision, for the reviewers";

describe("ResolveFlagForm", () => {
  beforeEach(() => resolveFlags.mockReset());

  it("needs a comment before dismissing", async () => {
    const { user } = renderWithProviders(
      <ResolveFlagForm itemId={ITEM} contentHash={HASH} />,
    );

    await user.click(screen.getByRole("button", { name: "Dismiss flags" }));

    expect(
      await screen.findByText("Explain your decision to the reviewers."),
    ).toBeVisible();
    expect(resolveFlags).not.toHaveBeenCalled();
  });

  it("dismisses with the comment", async () => {
    resolveFlags.mockResolvedValue({ ok: true });
    const { user } = renderWithProviders(
      <ResolveFlagForm itemId={ITEM} contentHash={HASH} />,
    );

    await user.type(screen.getByLabelText(LABEL), "C is a distractor.");
    await user.click(screen.getByRole("button", { name: "Dismiss flags" }));

    await waitFor(() =>
      expect(resolveFlags.mock.calls[0]?.[0]).toEqual({
        itemId: ITEM,
        contentHash: HASH,
        action: "dismiss",
        comment: "C is a distractor.",
      }),
    );
    expect(
      await screen.findByRole("button", { name: "Dismissing…" }),
    ).toBeDisabled();
    expect(screen.getByRole("button", { name: "Reject item" })).toBeDisabled();
  });

  it("rejects with the comment", async () => {
    resolveFlags.mockResolvedValue({ ok: true });
    const { user } = renderWithProviders(
      <ResolveFlagForm itemId={ITEM} contentHash={HASH} />,
    );

    await user.type(screen.getByLabelText(LABEL), "Unfixable as written.");
    await user.click(screen.getByRole("button", { name: "Reject item" }));

    await waitFor(() =>
      expect(resolveFlags.mock.calls[0]?.[0]).toMatchObject({
        action: "reject",
      }),
    );
  });

  it("shows the database's refusal", async () => {
    resolveFlags.mockResolvedValue({
      ok: false,
      error: { message: "You can't do this for this item." },
    });
    const { user } = renderWithProviders(
      <ResolveFlagForm itemId={ITEM} contentHash={HASH} />,
    );

    await user.type(screen.getByLabelText(LABEL), "Looks fine.");
    await user.click(screen.getByRole("button", { name: "Dismiss flags" }));

    expect(
      await screen.findByText("You can't do this for this item."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Dismiss flags" })).toBeEnabled();
  });
});
