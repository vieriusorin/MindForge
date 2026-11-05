// MF-0026 acceptance (frozen): SC-2 one attempt per double submit in Seed Planting; SC-3 the guard
// releases after a failed answer and after "Next" (a regression lock: a guard that never releases
// would pass SC-2 and strand the learner).
import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PlayableQuestion } from "@/engine/questions";
import { renderHookWithProviders } from "@/test/render";
import { useSeedChecks } from "../hooks/use-seed-checks";

const { answerSeedCheck } = vi.hoisted(() => ({ answerSeedCheck: vi.fn() }));

// Mock at the facade the hook depends on: the Server Action.
vi.mock("@/features/seed-planting/actions", () => ({ answerSeedCheck }));

const check = (id: string): PlayableQuestion => ({
  id,
  skillCode: "S1",
  origin: "ai",
  stem: `Stem of ${id}`,
  select: 1,
  options: [
    { id: "A", text: "First" },
    { id: "B", text: "Second" },
  ],
  source: { title: "Docs", url: "https://example.com" },
  contentHash: `h-${id}`,
});

const CHECKS = [check("p.S1.1"), check("p.S1.2")];

const GRADED = {
  ok: true,
  feedback: {
    correct: true,
    correctOptionIds: ["A"],
    rationales: { A: "Why A is right", B: "Why B is wrong" },
  },
} as const;

function renderSeedHook() {
  return renderHookWithProviders(() =>
    useSeedChecks({ packSlug: "p", checks: CHECKS, wasSeed: true }),
  );
}

describe("MF-0026 Seed Planting: one attempt per Check answer", () => {
  beforeEach(() => {
    answerSeedCheck.mockReset();
  });

  it("SC-2: two submits before a re-render record one attempt", async () => {
    answerSeedCheck.mockResolvedValue(GRADED);
    const { result } = renderSeedHook();

    act(() => result.current.toggle("A"));
    act(() => {
      result.current.submit();
      result.current.submit();
    });

    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerSeedCheck).toHaveBeenCalledTimes(1);
  });

  it("SC-3: after an ok:false answer, the next submit calls the action again", async () => {
    answerSeedCheck
      .mockResolvedValueOnce({ ok: false, error: "Try again." })
      .mockResolvedValueOnce(GRADED);
    const { result } = renderSeedHook();

    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.error).toBe("Try again."));

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerSeedCheck).toHaveBeenCalledTimes(2);
  });

  it("SC-3: after a network error, the next submit calls the action again", async () => {
    answerSeedCheck
      .mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(GRADED);
    const { result } = renderSeedHook();

    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() =>
      expect(result.current.error).toBe(
        "Could not reach the server. Try again.",
      ),
    );

    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());
    expect(answerSeedCheck).toHaveBeenCalledTimes(2);
  });

  it("SC-3: after Next, the next check's submit calls the action again", async () => {
    answerSeedCheck.mockResolvedValue(GRADED);
    const { result } = renderSeedHook();

    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() => expect(result.current.feedback).not.toBeNull());

    act(() => result.current.next());
    act(() => result.current.toggle("A"));
    act(() => result.current.submit());
    await waitFor(() => expect(answerSeedCheck).toHaveBeenCalledTimes(2));
    // TanStack passes a context object as the second argument; assert the input only.
    expect(answerSeedCheck.mock.lastCall?.[0]).toMatchObject({
      questionId: "p.S1.2",
    });
  });
});
