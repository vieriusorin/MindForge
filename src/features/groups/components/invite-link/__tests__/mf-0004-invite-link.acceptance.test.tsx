/**
 * MF-0004 acceptance (SC-9, screen half): when resetting the invite link fails, the invite card
 * says so. The rotate action is the prop the group page binds, so it is mocked as a prop.
 */
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { InviteLink } from "..";

const MESSAGE = "Only the group admin can reset the link.";

describe("MF-0004 InviteLink", () => {
  it("SC-9: shows the error when the reset fails", async () => {
    const rotateAction = vi
      .fn()
      .mockResolvedValue({ ok: false, error: MESSAGE });
    const { user } = renderWithProviders(
      <InviteLink
        inviteUrl="https://mindforge.vercel.app/join/abc"
        canRotate
        rotateAction={rotateAction}
      />,
    );

    await user.click(screen.getByRole("button", { name: /reset link/i }));

    expect(rotateAction).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("alert")).toHaveTextContent(MESSAGE);
  });
});
