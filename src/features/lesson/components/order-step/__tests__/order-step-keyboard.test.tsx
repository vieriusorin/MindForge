// MF-0066 review should-fix 4: keyboard focus stays on a sensible control after every move, and each move is
// announced in a polite live region.
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayableOrder } from "@/engine/content";
import { renderWithProviders } from "@/test/render";
import { OrderStep } from "..";

vi.mock("@/features/lesson/actions", () => ({ answerLessonOrder: vi.fn() }));

const ORDER: PlayableOrder = {
  id: "p.S1.order-1",
  skillCode: "S1",
  origin: "ai",
  title: "Order it",
  steps: [
    { id: "RUN", label: "Run the tool" },
    { id: "REQ", label: "Send the request" },
    { id: "RES", label: "Send the result" },
  ],
  contentHash: "h",
};

function renderStep() {
  return renderWithProviders(
    <OrderStep
      step={{ kind: "order", order: ORDER }}
      meta="Put in order"
      packSlug="p"
      isLast={false}
      onNext={vi.fn()}
    />,
  );
}

const liveRegion = (): HTMLElement => {
  const el = document.querySelector<HTMLElement>(
    '[aria-live="polite"]:not(output)',
  );
  if (!el) throw new Error("no polite live region for moves");
  return el;
};

describe("OrderStep keyboard and announcements", () => {
  it("after Add, focus moves to the next step to place, and the move is announced", async () => {
    const { user } = renderStep();
    await user.click(
      screen.getByRole("button", { name: "Add: Send the request" }),
    );
    expect(
      screen.getByRole("button", { name: "Add: Send the result" }),
    ).toHaveFocus();
    expect(liveRegion()).toHaveTextContent(
      'Added "Send the request" as step 1 of 3.',
    );
  });

  it("with the keyboard alone: Enter on each Add, focus lands on Check order when the pool is empty", async () => {
    const { user } = renderStep();
    screen.getByRole("button", { name: "Add: Run the tool" }).focus();
    await user.keyboard("{Enter}");
    expect(document.activeElement).toHaveAccessibleName(
      "Add: Send the request",
    );
    await user.keyboard("{Enter}");
    expect(document.activeElement).toHaveAccessibleName("Add: Send the result");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Check order" })).toHaveFocus();
    expect(liveRegion()).toHaveTextContent(
      'Added "Send the result" as step 3 of 3.',
    );
  });

  it("after Remove, focus returns to that step's Add button and the removal is announced", async () => {
    const { user } = renderStep();
    await user.click(screen.getByRole("button", { name: "Add: Run the tool" }));
    await user.click(
      screen.getByRole("button", { name: "Remove: Run the tool" }),
    );
    expect(
      screen.getByRole("button", { name: "Add: Run the tool" }),
    ).toHaveFocus();
    expect(liveRegion()).toHaveTextContent(
      'Removed "Run the tool". 0 of 3 placed.',
    );
  });

  it("two moves in a row that send focus to the same Add button still move focus (delta review D-2)", async () => {
    const { user } = renderStep();
    // Shown RUN, REQ, RES. Adding RES sends focus to REQ; adding RUN then sends it to REQ again.
    await user.click(
      screen.getByRole("button", { name: "Add: Send the result" }),
    );
    expect(
      screen.getByRole("button", { name: "Add: Send the request" }),
    ).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Add: Run the tool" }));
    expect(
      screen.getByRole("button", { name: "Add: Send the request" }),
    ).toHaveFocus();
    expect(liveRegion()).toHaveTextContent(
      'Added "Run the tool" as step 2 of 3.',
    );
  });
});
