import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { JoinCard } from "..";

const { push, joinGroup } = vi.hoisted(() => ({
  push: vi.fn(),
  joinGroup: vi.fn(),
}));

// Mock at the facades the hook depends on: the router and the Server Action.
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/groups/actions", () => ({ joinGroup }));

const CODE = "0123456789abcdef0123456789abcdef";
const PATH_NOTICE =
  "This group follows the Claude Developer path. Joining starts it for you.";

function renderReady(notice: string | null = null) {
  return renderWithProviders(
    <JoinCard
      status="ready"
      code={CODE}
      groupName="Night owls"
      notice={notice}
    />,
  );
}

describe("JoinCard", () => {
  beforeEach(() => {
    push.mockReset();
    joinGroup.mockReset();
  });

  it("names the group and shows the path notice before the Join button", () => {
    renderReady(PATH_NOTICE);

    expect(
      screen.getByText("You've been invited to Night owls."),
    ).toBeVisible();
    const notice = screen.getByText(PATH_NOTICE);
    const button = screen.getByRole("button", { name: "Join the group" });
    expect(
      notice.compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("shows no notice for a pack-only group", () => {
    renderReady(null);

    expect(screen.queryByText(/follows the/)).toBeNull();
    expect(
      screen.getByRole("button", { name: "Join the group" }),
    ).toBeEnabled();
  });

  it("joins with the code and navigates to the group", async () => {
    joinGroup.mockResolvedValue({ ok: true, groupId: "g-1" });
    const { user } = renderReady(PATH_NOTICE);

    await user.click(screen.getByRole("button", { name: "Join the group" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups/g-1"));
    expect(joinGroup).toHaveBeenCalledWith({ code: CODE });
    // Stays disabled through navigation so it can't join twice.
    expect(screen.getByRole("button", { name: "Joining…" })).toBeDisabled();
  });

  it("shows the server's error and re-enables the button", async () => {
    joinGroup.mockResolvedValue({
      ok: false,
      error:
        "This invite link is invalid or has been reset. Ask a group member for a new one.",
    });
    const { user } = renderReady();

    await user.click(screen.getByRole("button", { name: "Join the group" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This invite link is invalid or has been reset. Ask a group member for a new one.",
    );
    expect(
      screen.getByRole("button", { name: "Join the group" }),
    ).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("shows Joining… and disables the button while the join is pending", async () => {
    joinGroup.mockReturnValue(new Promise(() => {}));
    const { user } = renderReady();

    await user.click(screen.getByRole("button", { name: "Join the group" }));

    expect(
      await screen.findByRole("button", { name: "Joining…" }),
    ).toBeDisabled();
  });

  it("says the server could not be reached on a network failure", async () => {
    joinGroup.mockRejectedValue(new Error("Failed to fetch"));
    const { user } = renderReady();

    await user.click(screen.getByRole("button", { name: "Join the group" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again.",
    );
  });

  it("shows the invalid-link alert and no button for an invalid code", () => {
    renderWithProviders(<JoinCard status="invalid" />);

    expect(screen.getByRole("alert")).toHaveTextContent(
      "This invite link is invalid or has been reset. Ask a group member for a new one.",
    );
    expect(screen.queryByRole("button")).toBeNull();
  });
});
