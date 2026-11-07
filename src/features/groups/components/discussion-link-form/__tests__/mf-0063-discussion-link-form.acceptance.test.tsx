/**
 * MF-0063 acceptance (frozen, SC-5): the admin's discussion link form. Valid submit, client
 * validation error, server field error, server message, pending state, and Remove. Mocked at the
 * facades: the router and the Server Action. Literals from .planning/tasks/MF-0063/GOAL.md.
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { DiscussionLinkForm } from "..";

const GROUP_ID = "6f1c2a3b-4d5e-4f60-8a7b-9c0d1e2f3a4b";
const LINK = "https://chat.example.com/c/1";
const MESSAGE = "Use an https:// link, up to 500 characters.";

const { refresh, setGroupDiscussionLink } = vi.hoisted(() => ({
  refresh: vi.fn(),
  setGroupDiscussionLink: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/groups/actions", () => ({ setGroupDiscussionLink }));

function renderForm(currentUrl: string | null = null) {
  return renderWithProviders(
    <DiscussionLinkForm groupId={GROUP_ID} currentUrl={currentUrl} />,
  );
}

beforeEach(() => {
  refresh.mockReset();
  setGroupDiscussionLink.mockReset();
});

describe("MF-0063 SC-5: DiscussionLinkForm", () => {
  it("submits a valid link and refreshes the page", async () => {
    setGroupDiscussionLink.mockResolvedValue({ ok: true });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Chat link"), LINK);
    await user.click(screen.getByRole("button", { name: "Save link" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setGroupDiscussionLink.mock.calls[0]?.[0]).toEqual({
      groupId: GROUP_ID,
      url: LINK,
    });
  });

  it("shows the field error for a non-https link and calls nothing", async () => {
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Chat link"), "http://example.com");
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(await screen.findByText(MESSAGE)).toBeVisible();
    expect(screen.getByLabelText("Chat link")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(setGroupDiscussionLink).not.toHaveBeenCalled();
  });

  it("puts a server field error back on the field", async () => {
    setGroupDiscussionLink.mockResolvedValue({
      ok: false,
      error: { message: MESSAGE, fieldErrors: { url: MESSAGE } },
    });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Chat link"), LINK);
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(await screen.findByText(MESSAGE)).toBeVisible();
    expect(screen.getByLabelText("Chat link")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a server message under the form", async () => {
    setGroupDiscussionLink.mockResolvedValue({
      ok: false,
      error: {
        message: "Only the group admin can change the discussion link.",
      },
    });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Chat link"), LINK);
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(
      await screen.findByText(
        "Only the group admin can change the discussion link.",
      ),
    ).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a message when the server can't be reached", async () => {
    setGroupDiscussionLink.mockRejectedValue(new Error("network"));
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Chat link"), LINK);
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(
      await screen.findByText("Could not reach the server. Try again."),
    ).toBeVisible();
  });

  it("disables Save while the save is pending", async () => {
    setGroupDiscussionLink.mockReturnValue(new Promise(() => {}));
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Chat link"), LINK);
    await user.click(screen.getByRole("button", { name: "Save link" }));

    expect(
      await screen.findByRole("button", { name: "Saving…" }),
    ).toBeDisabled();
  });

  it("starts from the current link, and Remove sends an empty url", async () => {
    setGroupDiscussionLink.mockResolvedValue({ ok: true });
    const { user } = renderForm(LINK);

    expect(screen.getByLabelText("Chat link")).toHaveValue(LINK);
    await user.click(screen.getByRole("button", { name: "Remove link" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(setGroupDiscussionLink.mock.calls[0]?.[0]).toEqual({
      groupId: GROUP_ID,
      url: "",
    });
  });

  it("offers no Remove while no link is set", () => {
    renderForm();
    expect(screen.queryByRole("button", { name: "Remove link" })).toBeNull();
  });
});
