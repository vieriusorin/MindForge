import { act, waitFor } from "@testing-library/react";
import { useController } from "react-hook-form";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHookWithProviders } from "@/test/render";
import { useCreateGroupForm } from "../hooks/use-create-group-form";

const { push, createGroup, createPathGroup } = vi.hoisted(() => ({
  push: vi.fn(),
  createGroup: vi.fn(),
  createPathGroup: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/features/groups/actions", () => ({
  createGroup,
  createPathGroup,
}));

describe("useCreateGroupForm", () => {
  beforeEach(() => {
    push.mockReset();
    createGroup.mockReset();
    createPathGroup.mockReset();
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

  it("blocks a path group with no path chosen (MF-0059)", async () => {
    const { result } = renderHookWithProviders(() => {
      const form = useCreateGroupForm("ccdv-f");
      // Drives the kind the way the RadioGroup's Controller does.
      const kind = useController({ control: form.control, name: "kind" });
      const name = useController({ control: form.control, name: "name" });
      return { form, kind, name };
    });

    act(() => {
      result.current.kind.field.onChange("path");
      result.current.name.field.onChange("Path pals");
    });
    await act(() => result.current.form.onSubmit());

    await waitFor(() =>
      expect(result.current.form.errors.pathSlug?.message).toBe("Pick a path."),
    );
    expect(result.current.form.kind).toBe("path");
    expect(createPathGroup).not.toHaveBeenCalled();
    expect(createGroup).not.toHaveBeenCalled();
  });
});
