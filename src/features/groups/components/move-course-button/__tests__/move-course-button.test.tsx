import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { MoveCourseButton } from "..";

const { refresh, advanceGroupCourse } = vi.hoisted(() => ({
  refresh: vi.fn(),
  advanceGroupCourse: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/groups/actions", () => ({ advanceGroupCourse }));

const GROUP_ID = "7b0f0c1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f";
const RUNNING = "This ends the running expedition.";

function renderButton(
  overrides: Partial<{
    nextCourseName: string | null;
    disabledReason: string | null;
    hasRunningExpedition: boolean;
  }> = {},
) {
  return renderWithProviders(
    <MoveCourseButton
      groupId={GROUP_ID}
      fromPack="ai-capabilities"
      nextCourseName="Platform Foundations"
      disabledReason={null}
      hasRunningExpedition={false}
      {...overrides}
    />,
  );
}

describe("MoveCourseButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    advanceGroupCourse.mockReset();
  });

  it("asks before moving and warns when an expedition runs", async () => {
    const { user } = renderButton({ hasRunningExpedition: true });

    await user.click(
      screen.getByRole("button", { name: "Move to next course" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).toHaveTextContent("Move to Platform Foundations?");
    expect(dialog).toHaveTextContent(RUNNING);
    expect(advanceGroupCourse).not.toHaveBeenCalled();
  });

  it("does not mention an expedition when none runs", async () => {
    const { user } = renderButton();

    await user.click(
      screen.getByRole("button", { name: "Move to next course" }),
    );

    const dialog = await screen.findByRole("alertdialog");
    expect(dialog).not.toHaveTextContent(RUNNING);
  });

  it("moves from the shown course on confirm and refreshes the page", async () => {
    advanceGroupCourse.mockResolvedValue({ ok: true });
    const { user } = renderButton();

    await user.click(
      screen.getByRole("button", { name: "Move to next course" }),
    );
    await user.click(await screen.findByRole("button", { name: "Move" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(advanceGroupCourse).toHaveBeenCalledTimes(1);
    expect(advanceGroupCourse.mock.calls[0]?.[0]).toEqual({
      groupId: GROUP_ID,
      fromPack: "ai-capabilities",
    });
  });

  it("shows the server's reason when the move is refused", async () => {
    advanceGroupCourse.mockResolvedValue({
      ok: false,
      error: "The group has moved on since you opened this page.",
    });
    const { user } = renderButton();

    await user.click(
      screen.getByRole("button", { name: "Move to next course" }),
    );
    await user.click(await screen.findByRole("button", { name: "Move" }));

    expect(
      await screen.findByText(
        "The group has moved on since you opened this page.",
      ),
    ).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
    expect(
      screen.getByRole("button", { name: "Move to next course" }),
    ).toBeEnabled();
  });

  it("is disabled with its reason at the last course", () => {
    renderButton({
      nextCourseName: null,
      disabledReason: "Last course of the path",
    });

    expect(
      screen.getByRole("button", { name: "Move to next course" }),
    ).toBeDisabled();
    expect(screen.getByText("Last course of the path")).toBeVisible();
  });

  it("is disabled while the move is pending", async () => {
    advanceGroupCourse.mockReturnValue(new Promise(() => {}));
    const { user } = renderButton();
    const trigger = screen.getByRole("button", { name: "Move to next course" });

    await user.click(trigger);
    await user.click(await screen.findByRole("button", { name: "Move" }));

    await waitFor(() => expect(trigger).toBeDisabled());
    expect(trigger).toHaveTextContent("Moving…");
  });
});
