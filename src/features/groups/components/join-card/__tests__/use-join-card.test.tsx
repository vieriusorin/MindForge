import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useJoinCard } from "../hooks/use-join-card";

const { push, joinGroup } = vi.hoisted(() => ({
  push: vi.fn(),
  joinGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/groups/actions", () => ({ joinGroup }));

const CODE = "0123456789abcdef0123456789abcdef";

describe("useJoinCard", () => {
  beforeEach(() => {
    push.mockReset();
    joinGroup.mockReset();
  });

  it("starts idle with no error", () => {
    const { result } = renderHookWithProviders(() => useJoinCard(CODE));

    expect(result.current.isPending).toBe(false);
    expect(result.current.errorMessage).toBeNull();
    expect(joinGroup).not.toHaveBeenCalled();
  });

  it("joins with its code, navigates, and stays pending after success", async () => {
    joinGroup.mockResolvedValue({ ok: true, groupId: "g-1" });
    const { result } = renderHookWithProviders(() => useJoinCard(CODE));

    act(() => result.current.join());

    await waitFor(() => expect(push).toHaveBeenCalledWith("/groups/g-1"));
    expect(joinGroup).toHaveBeenCalledWith({ code: CODE });
    expect(result.current.isPending).toBe(true);
    expect(result.current.errorMessage).toBeNull();
  });

  it("returns the server's refusal and does not navigate", async () => {
    joinGroup.mockResolvedValue({
      ok: false,
      error: "Could not join the group. Try again.",
    });
    const { result } = renderHookWithProviders(() => useJoinCard(CODE));

    act(() => result.current.join());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Could not join the group. Try again.",
      ),
    );
    expect(result.current.isPending).toBe(false);
    expect(push).not.toHaveBeenCalled();
  });

  it("reports a network failure", async () => {
    joinGroup.mockRejectedValue(new Error("Failed to fetch"));
    const { result } = renderHookWithProviders(() => useJoinCard(CODE));

    act(() => result.current.join());

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        "Could not reach the server. Try again.",
      ),
    );
    expect(result.current.isPending).toBe(false);
  });
});
