// MF-0016 review finding 6: after a refusal ("Start a new round") the learner is not stuck.
import { screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { PlayableCuckoo } from "@/engine/content";
import { renderWithProviders } from "@/test/render";
import { CuckooSession } from "..";

const { answerCuckoo } = vi.hoisted(() => ({ answerCuckoo: vi.fn() }));
vi.mock("@/features/cuckoo/actions", () => ({ answerCuckoo }));

const cuckoo = (id: string): PlayableCuckoo => ({
  id,
  skillCode: "S1",
  origin: "ai",
  title: `Title of ${id}`,
  snippetKind: "config",
  lines: ["a: 1", "b: 2", "c: 3"],
  contentHash: `h-${id}`,
});

describe("CuckooSession after a refusal", () => {
  it("offers to skip to the next snippet instead of re-sending the refused answer", async () => {
    answerCuckoo.mockResolvedValue({
      ok: false,
      error: "This cuckoo changed since you opened it. Start a new round.",
    });
    const { user } = renderWithProviders(
      <CuckooSession
        packSlug="p"
        cuckoos={[cuckoo("p.S1.1"), cuckoo("p.S1.2")]}
        skillNames={{}}
        back={{ href: "/today", label: "Back to your forest" }}
      />,
    );
    await user.click(screen.getByRole("radio", { name: "Line 2" }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await user.click(
      await screen.findByRole("button", { name: "Skip this snippet" }),
    );

    expect(
      await screen.findByRole("heading", { name: "Title of p.S1.2" }),
    ).toHaveFocus();
    expect(answerCuckoo).toHaveBeenCalledTimes(1);
  });
});
