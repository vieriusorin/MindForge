import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import {
  applyFormError,
  FALLBACK_FORM_MESSAGE,
  formErrorFromZod,
} from "../action-result";

const Input = z.strictObject({
  name: z.string().min(1, "Give the group a name."),
  packSlug: z.string().regex(/^[a-z]+$/, "Pick a learning pack."),
});

describe("formErrorFromZod", () => {
  it("keeps the first message per field and falls back for the form message", () => {
    const parsed = Input.safeParse({ name: "", packSlug: "NOPE" });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    expect(formErrorFromZod(parsed.error)).toEqual({
      message: FALLBACK_FORM_MESSAGE,
      fieldErrors: {
        name: "Give the group a name.",
        packSlug: "Pick a learning pack.",
      },
    });
  });

  it("uses a form-level issue as the message", () => {
    const parsed = Input.safeParse({ name: "a", packSlug: "abc", extra: 1 });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;
    const result = formErrorFromZod(parsed.error);
    expect(result.message).not.toBe(FALLBACK_FORM_MESSAGE);
    expect(result.fieldErrors).toEqual({});
  });
});

describe("applyFormError", () => {
  it("sets field errors, focuses only the first, and skips the root message", () => {
    const setError = vi.fn();
    applyFormError<{ name: string; packSlug: string }>(setError, {
      message: "ignored",
      fieldErrors: { name: "Too long.", packSlug: "Pick a learning pack." },
    });
    expect(setError.mock.calls).toEqual([
      ["name", { type: "server", message: "Too long." }, { shouldFocus: true }],
      [
        "packSlug",
        { type: "server", message: "Pick a learning pack." },
        { shouldFocus: false },
      ],
    ]);
  });

  it("puts the message on root.server when no field explains the failure", () => {
    const setError = vi.fn();
    applyFormError<{ name: string }>(setError, {
      message: "Could not create the group. Try again.",
    });
    expect(setError.mock.calls).toEqual([
      [
        "root.server",
        { type: "server", message: "Could not create the group. Try again." },
      ],
    ]);
  });
});
