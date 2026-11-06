import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useStartPathButton } from "../hooks/use-start-path-button";

const { refresh, startPath } = vi.hoisted(() => ({
  refresh: vi.fn(),
  startPath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/paths/actions", () => ({ startPath }));

describe("useStartPathButton", () => {
  beforeEach(() => {
    refresh.mockReset();
    startPath.mockReset();
  });

  it("starts the path it was given and refreshes the page on success", async () => {
    startPath.mockResolvedValue({ ok: true });
    const { result } = renderHookWithProviders(() =>
      useStartPathButton({ pathSlug: "claude-developer" }),
    );

    act(() => result.current.start());

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(startPath).toHaveBeenCalledWith({ pathSlug: "claude-developer" });
    expect(result.current.errorMessage).toBeNull();
  });

  it("shows the server's refusal and doesn't refresh", async () => {
    startPath.mockResolvedValue({
      ok: false,
      error: "This path doesn't exist.",
    });
    const { result } = renderHookWithProviders(() =>
      useStartPathButton({ pathSlug: "nope" }),
    );

    act(() => result.current.start());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe("This path doesn't exist."),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a network message when the action throws", async () => {
    startPath.mockRejectedValue(new Error("fetch failed"));
    const { result } = renderHookWithProviders(() =>
      useStartPathButton({ pathSlug: "claude-developer" }),
    );

    act(() => result.current.start());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Could not reach the server. Try again.",
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is pending while the action runs", async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    startPath.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHookWithProviders(() =>
      useStartPathButton({ pathSlug: "claude-developer" }),
    );

    act(() => result.current.start());

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => resolve({ ok: true }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
