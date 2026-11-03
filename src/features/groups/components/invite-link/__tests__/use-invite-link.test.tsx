import { act, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useInviteLink } from "../hooks/use-invite-link";

describe("useInviteLink", () => {
  it("has no error after a successful reset", async () => {
    const rotate = vi.fn().mockResolvedValue({ ok: true });
    const { result } = renderHookWithProviders(() => useInviteLink(rotate));

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.isResetting).toBe(false));
    expect(rotate).toHaveBeenCalledTimes(1);
    expect(result.current.errorMessage).toBeNull();
  });

  it("is pending while the reset runs", async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    const rotate = vi.fn(
      () =>
        new Promise<{ ok: true }>((r) => {
          resolve = r;
        }),
    );
    const { result } = renderHookWithProviders(() => useInviteLink(rotate));

    act(() => result.current.reset());

    await waitFor(() => expect(result.current.isResetting).toBe(true));
    act(() => resolve({ ok: true }));
    await waitFor(() => expect(result.current.isResetting).toBe(false));
  });

  it("exposes the action's error message", async () => {
    const rotate = vi.fn().mockResolvedValue({
      ok: false,
      error: "Only the group admin can reset the link.",
    });
    const { result } = renderHookWithProviders(() => useInviteLink(rotate));

    act(() => result.current.reset());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Only the group admin can reset the link.",
      ),
    );
  });

  it("reports a network failure", async () => {
    const rotate = vi.fn().mockRejectedValue(new Error("fetch failed"));
    const { result } = renderHookWithProviders(() => useInviteLink(rotate));

    act(() => result.current.reset());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Could not reach the server. Try again.",
      ),
    );
  });
});
