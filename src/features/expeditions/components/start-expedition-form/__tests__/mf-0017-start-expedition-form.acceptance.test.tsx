/**
 * MF-0017 acceptance (UI, form half of SC-5): the admin starts an expedition with a domain select
 * and a target; field errors are shown; the screen refreshes after a start. Copy and defaults come
 * from GOAL.md ("Decided without a question": target 10–1000, form default 100).
 */
import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { StartExpeditionForm } from "..";

const { push, refresh, startExpedition } = vi.hoisted(() => ({
  push: vi.fn(),
  refresh: vi.fn(),
  startExpedition: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));
vi.mock("@/features/expeditions/actions", () => ({ startExpedition }));

const GROUP_ID = "7b0f0c1e-3a2d-4c5b-9e8f-1a2b3c4d5e6f";
const DOMAINS = [
  { code: "D1", name: "Agentic Architecture" },
  { code: "D2", name: "Security & Safety" },
];
const RANGE_MESSAGE = "Pick a whole number from 10 to 1000.";

function renderForm() {
  return renderWithProviders(
    <StartExpeditionForm groupId={GROUP_ID} domains={DOMAINS} />,
  );
}

describe("MF-0017 StartExpeditionForm", () => {
  beforeEach(() => {
    push.mockReset();
    refresh.mockReset();
    startExpedition.mockReset();
  });

  it("SC-5: defaults to the first domain and a target of 100, submits them and refreshes the page", async () => {
    startExpedition.mockResolvedValue({ ok: true, expeditionId: "e-1" });
    const { user } = renderForm();

    expect(screen.getByLabelText("Domain")).toHaveTextContent(
      "Agentic Architecture",
    );
    expect(screen.getByLabelText("Target")).toHaveValue(100);

    await user.click(screen.getByRole("button", { name: "Start expedition" }));

    await waitFor(() => expect(refresh).toHaveBeenCalled());
    expect(startExpedition).toHaveBeenCalledTimes(1);
    expect(startExpedition.mock.calls[0]?.[0]).toEqual({
      groupId: GROUP_ID,
      domainCode: "D1",
      target: 100,
    });
  });

  it("SC-5: a target below 10 or above 1000 shows the field error and does not call the action", async () => {
    const { user } = renderForm();
    const target = screen.getByLabelText("Target");

    await user.clear(target);
    await user.type(target, "5");
    await user.click(screen.getByRole("button", { name: "Start expedition" }));
    expect(await screen.findByText(RANGE_MESSAGE)).toBeVisible();
    expect(target).toHaveAttribute("aria-invalid", "true");

    await user.clear(target);
    await user.type(target, "1001");
    await user.click(screen.getByRole("button", { name: "Start expedition" }));
    expect(await screen.findByText(RANGE_MESSAGE)).toBeVisible();

    expect(startExpedition).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("SC-5: a form-level server error is shown and the page is not refreshed", async () => {
    startExpedition.mockResolvedValue({
      ok: false,
      error: { message: "An expedition is already running." },
    });
    const { user } = renderForm();

    await user.click(screen.getByRole("button", { name: "Start expedition" }));

    expect(
      await screen.findByText("An expedition is already running."),
    ).toBeVisible();
    expect(refresh).not.toHaveBeenCalled();
  });

  it("SC-5 (SC-1 action half): a server field error lands on its field", async () => {
    startExpedition.mockResolvedValue({
      ok: false,
      error: {
        message: "Check the highlighted fields.",
        fieldErrors: { domainCode: "That domain is not in this group's pack." },
      },
    });
    const { user } = renderForm();

    await user.click(screen.getByRole("button", { name: "Start expedition" }));

    expect(
      await screen.findByText("That domain is not in this group's pack."),
    ).toBeVisible();
    expect(screen.getByLabelText("Domain")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("SC-5: the submit button is disabled while the action is pending", async () => {
    startExpedition.mockReturnValue(new Promise(() => {}));
    const { user } = renderForm();
    // the same element, whatever its pending label is
    const button = screen.getByRole("button", { name: "Start expedition" });

    await user.click(button);

    await waitFor(() => expect(button).toBeDisabled());
    expect(startExpedition).toHaveBeenCalledTimes(1);
  });
});
