import { screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { StormStart } from "..";

const { push, startStorm } = vi.hoisted(() => ({
  push: vi.fn(),
  startStorm: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/storm/actions", () => ({ startStorm }));

function renderStart() {
  return renderWithProviders(
    <StormStart
      packSlug="ccdv-f"
      kind="boss"
      domainCode="D2"
      questionCount={12}
      durationSeconds={1630}
    />,
  );
}

describe("StormStart", () => {
  beforeEach(() => {
    push.mockReset();
    startStorm.mockReset();
  });

  it("shows the size and the clock", () => {
    renderStart();
    expect(
      screen.getByRole("heading", {
        name: "Up to 12 questions in 28 minutes",
      }),
    ).toBeVisible();
  });

  it("a successful start opens the storm", async () => {
    startStorm.mockResolvedValue({ ok: true, stormId: "s-1" });
    const { user } = renderStart();

    await user.click(screen.getByRole("button", { name: "Start the storm" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/storms/s-1"));
    expect(startStorm.mock.calls[0]?.[0]).toEqual({
      packSlug: "ccdv-f",
      kind: "boss",
      domainCode: "D2",
    });
  });

  it("shows the server's refusal and lets the learner try again", async () => {
    startStorm.mockResolvedValue({
      ok: false,
      error: "You already have a storm running. Finish it first.",
    });
    const { user } = renderStart();

    await user.click(screen.getByRole("button", { name: "Start the storm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "You already have a storm running. Finish it first.",
    );
    expect(
      screen.getByRole("button", { name: "Start the storm" }),
    ).toBeEnabled();
    expect(push).not.toHaveBeenCalled();
  });

  it("says the server is unreachable on a network failure", async () => {
    startStorm.mockRejectedValue(new Error("offline"));
    const { user } = renderStart();

    await user.click(screen.getByRole("button", { name: "Start the storm" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Could not reach the server. Try again.",
    );
  });

  it("disables the button while starting, so one click starts one storm", async () => {
    let resolve: (value: unknown) => void = () => {};
    startStorm.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { user } = renderStart();

    await user.click(screen.getByRole("button", { name: "Start the storm" }));

    expect(screen.getByRole("button", { name: "Starting…" })).toBeDisabled();
    resolve({ ok: true, stormId: "s-1" });
    await waitFor(() => expect(push).toHaveBeenCalledTimes(1));
    expect(startStorm).toHaveBeenCalledTimes(1);
  });
});
