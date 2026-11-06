import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { CreateGroupForm } from "..";

const { push, createGroup, createPathGroup } = vi.hoisted(() => ({
  push: vi.fn(),
  createGroup: vi.fn(),
  createPathGroup: vi.fn(),
}));

// Mock at the facades the hook depends on: the router and the Server Action.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/groups/actions", () => ({
  createGroup,
  createPathGroup,
}));

const PACKS = [{ slug: "ccdv-f", name: "Claude Certified Developer" }];
const PATHS = [{ slug: "claude-developer", name: "Claude Developer" }];
const CREATE_NOTICE =
  "This group follows the Claude Developer path. Creating it starts the path for you, and joining starts it for each member.";

function renderForm() {
  return renderWithProviders(<CreateGroupForm packs={PACKS} paths={PATHS} />);
}

describe("CreateGroupForm", () => {
  beforeEach(() => {
    push.mockReset();
    createGroup.mockReset();
    createPathGroup.mockReset();
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

  // MF-0059 SC-7: a group can follow a path instead of one pack.
  it("defaults to Pack and shows no path notice", () => {
    renderForm();

    expect(screen.getByRole("radio", { name: "Pack" })).toBeChecked();
    expect(screen.getByLabelText("Learning pack")).toBeVisible();
    expect(screen.queryByText(CREATE_NOTICE)).toBeNull();
  });

  it("shows the path select and the enroll notice when Path is chosen", async () => {
    const { user } = renderForm();

    await user.click(screen.getByRole("radio", { name: "Path" }));

    expect(screen.getByLabelText("Learning path")).toHaveTextContent(
      "Claude Developer",
    );
    expect(screen.getByText(CREATE_NOTICE)).toBeVisible();
    expect(screen.queryByLabelText("Learning pack")).toBeNull();
  });

  it("creates a path group and navigates to it", async () => {
    createPathGroup.mockResolvedValue({ ok: true, groupId: "g-2" });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Group name"), " Path pals ");
    await user.click(screen.getByRole("radio", { name: "Path" }));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups/g-2"));
    expect(createPathGroup.mock.calls[0]?.[0]).toEqual({
      name: "Path pals",
      pathSlug: "claude-developer",
    });
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("puts a server path error on the path select", async () => {
    createPathGroup.mockResolvedValue({
      ok: false,
      error: {
        message: "Pick a path.",
        fieldErrors: { pathSlug: "Pick a path." },
      },
    });
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Group name"), "Path pals");
    await user.click(screen.getByRole("radio", { name: "Path" }));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(await screen.findByText("Pick a path.")).toBeVisible();
    expect(screen.getByLabelText("Learning path")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(push).not.toHaveBeenCalled();
  });

  it("disables the button while a path group is being created", async () => {
    createPathGroup.mockReturnValue(new Promise(() => {}));
    const { user } = renderForm();

    await user.type(screen.getByLabelText("Group name"), "Path pals");
    await user.click(screen.getByRole("radio", { name: "Path" }));
    await user.click(screen.getByRole("button", { name: "Create group" }));

    expect(
      await screen.findByRole("button", { name: "Creating…" }),
    ).toBeDisabled();
  });

  it("offers no Pack/Path choice when there is no path", () => {
    renderWithProviders(<CreateGroupForm packs={PACKS} paths={[]} />);

    expect(screen.queryByRole("radio")).toBeNull();
    expect(screen.getByLabelText("Learning pack")).toBeVisible();
  });
});
