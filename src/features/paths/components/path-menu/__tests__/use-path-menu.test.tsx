import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { usePathMenu } from "../hooks/use-path-menu";

const { refresh, leavePath } = vi.hoisted(() => ({
  refresh: vi.fn(),
  leavePath: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/features/paths/actions", () => ({ leavePath }));

describe("usePathMenu", () => {
  beforeEach(() => {
    refresh.mockReset();
    leavePath.mockReset();
  });

  it("leaves the path it was given and refreshes the page on success", async () => {
    leavePath.mockResolvedValue({ ok: true });
    const { result } = renderHookWithProviders(() =>
      usePathMenu({ pathSlug: "claude-developer" }),
    );

    act(() => result.current.leave());

    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(leavePath).toHaveBeenCalledWith({ pathSlug: "claude-developer" });
    expect(result.current.errorMessage).toBeNull();
  });

  it("shows the server's refusal and doesn't refresh", async () => {
    leavePath.mockResolvedValue({
      ok: false,
      error: "Could not leave the path. Try again.",
    });
    const { result } = renderHookWithProviders(() =>
      usePathMenu({ pathSlug: "nope" }),
    );

    act(() => result.current.leave());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Could not leave the path. Try again.",
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("shows a network message when the action throws", async () => {
    leavePath.mockRejectedValue(new Error("fetch failed"));
    const { result } = renderHookWithProviders(() =>
      usePathMenu({ pathSlug: "claude-developer" }),
    );

    act(() => result.current.leave());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Could not reach the server. Try again.",
      ),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("is pending while the action runs", async () => {
    let resolve: (value: { ok: true }) => void = () => {};
    leavePath.mockReturnValue(
      new Promise((r) => {
        resolve = r;
      }),
    );
    const { result } = renderHookWithProviders(() =>
      usePathMenu({ pathSlug: "claude-developer" }),
    );

    act(() => result.current.leave());

    await waitFor(() => expect(result.current.isPending).toBe(true));
    await act(async () => resolve({ ok: true }));
    await waitFor(() => expect(result.current.isPending).toBe(false));
  });
});
