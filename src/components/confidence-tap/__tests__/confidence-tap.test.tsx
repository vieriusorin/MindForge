import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/render";
import { ConfidenceTap } from "..";

// MF-0065 review should-fix 2: the pressed tap must read as pressed without relying on colour (ui-design §5,
// WCAG 1.4.11): it carries a check mark that the unpressed one does not.
describe("ConfidenceTap", () => {
  it("marks only the pressed button with a check icon", () => {
    renderWithProviders(
      <ConfidenceTap value="sure" isLocked={false} onChoose={vi.fn()} />,
    );
    const sure = screen.getByRole("button", { name: "Sure" });
    const notSure = screen.getByRole("button", { name: "Not sure" });
    expect(sure).toHaveAttribute("aria-pressed", "true");
    expect(sure.querySelector("svg")).not.toBeNull();
    expect(notSure).toHaveAttribute("aria-pressed", "false");
    expect(notSure.querySelector("svg")).toBeNull();
  });

  it("shows no check mark before a tap, and reports the tapped value", async () => {
    const onChoose = vi.fn();
    const { user } = renderWithProviders(
      <ConfidenceTap value={null} isLocked={false} onChoose={onChoose} />,
    );
    for (const name of ["Sure", "Not sure"]) {
      expect(
        screen.getByRole("button", { name }).querySelector("svg"),
      ).toBeNull();
    }
    await user.click(screen.getByRole("button", { name: "Not sure" }));
    expect(onChoose).toHaveBeenCalledWith("unsure");
  });
});
