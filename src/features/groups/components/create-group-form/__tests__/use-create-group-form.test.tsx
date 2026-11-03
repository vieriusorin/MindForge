import { act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useCreateGroupForm } from "../hooks/use-create-group-form";

const { push, createGroup } = vi.hoisted(() => ({
  push: vi.fn(),
  createGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/groups/actions", () => ({ createGroup }));

describe("useCreateGroupForm", () => {
  beforeEach(() => {
    push.mockReset();
    createGroup.mockReset();
  });

  it("starts idle with no errors", () => {
    const { result } = renderHookWithProviders(() =>
      useCreateGroupForm("ccdv-f"),
    );

    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.errors).toEqual({});
  });

  it("blocks submit on invalid input without calling the action", async () => {
    const { result } = renderHookWithProviders(() =>
      useCreateGroupForm("ccdv-f"),
    );

    await act(() => result.current.onSubmit());

    await waitFor(() =>
      expect(result.current.errors.name?.message).toBe(
        "Give the group a name.",
      ),
    );
    expect(createGroup).not.toHaveBeenCalled();
  });

  it("rejects an invalid default pack before reaching the server", async () => {
    const { result } = renderHookWithProviders(() => useCreateGroupForm(""));

    await act(() => result.current.onSubmit());

    await waitFor(() =>
      expect(result.current.errors.packSlug?.message).toBe(
        "Pick a learning pack.",
      ),
    );
    expect(createGroup).not.toHaveBeenCalled();
  });
});
