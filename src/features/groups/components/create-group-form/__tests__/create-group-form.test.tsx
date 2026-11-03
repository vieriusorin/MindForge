import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CreateGroupForm } from "..";

const { push, createGroup } = vi.hoisted(() => ({
  push: vi.fn(),
  createGroup: vi.fn(),
}));

// Mock at the facades the hook depends on: the router and the Server Action.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/groups/actions", () => ({ createGroup }));

const PACKS = [{ slug: "ccdv-f", name: "Claude Certified Developer" }];

function renderForm() {
  return renderWithProviders(<CreateGroupForm packs={PACKS} />);
}

describe("CreateGroupForm", () => {
  beforeEach(() => {
    push.mockReset();
    createGroup.mockReset();
  });

  it("shows the field error and does not call the action when the name is empty", async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(await screen.findByText("Give the group a name.")).toBeVisible();
    expect(screen.getByLabelText("Group name")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("submits the parsed values and navigates to the new group", async () => {
    createGroup.mockResolvedValue({ ok: true, groupId: "g-1" });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Group name"), "  Night owls  ");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups/g-1"));
    // The resolver hands the action the schema output: name is trimmed, default pack kept.
    expect(createGroup.mock.calls[0]?.[0]).toEqual({
      name: "Night owls",
      packSlug: "ccdv-f",
    });
    // Stays disabled through navigation so it can't double-submit.
    expect(screen.getByRole("button", { name: "Creating…" })).toBeDisabled();
  });

  it("puts a server field error back on its field", async () => {
    createGroup.mockResolvedValue({
      ok: false,
      error: {
        message: "Check the highlighted fields.",
        fieldErrors: { name: "That name is taken." },
      },
    });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Group name"), "Taken");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(await screen.findByText("That name is taken.")).toBeVisible();
    expect(screen.queryByText("Check the highlighted fields.")).toBeNull();
    expect(push).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Create group" })).toBeEnabled();
  });

  it("shows a form-level message when the server can't be reached", async () => {
    createGroup.mockRejectedValue(new Error("network"));
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Group name"), "Offline");
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(
      await screen.findByText("Could not reach the server. Try again."),
    ).toBeVisible();
    expect(push).not.toHaveBeenCalled();
  });
});
