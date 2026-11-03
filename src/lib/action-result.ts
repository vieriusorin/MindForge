import type { FieldPath, FieldValues, UseFormSetError } from "react-hook-form";
import { z } from "zod";

export type NoData = Record<never, never>;

/**
 * The one result carrier for Server Actions (`typescript-strict` §1). Discriminate on `ok`,
 * never on `status`. Instantiate it (`ActionResult<{ groupId: string }>`); don't hand-write
 * a new `{ ok … }` union.
 */
export type ActionResult<TData extends object = NoData, TError = string> =
  | ({ ok: true } & TData)
  | { ok: false; error: TError };

/** What a failed form action sends back: a form-level message and/or per-field messages. */
export interface FormError<TField extends string = string> {
  message: string;
  fieldErrors?: Partial<Record<TField, string>>;
}

/** An action result whose error can be mapped onto react-hook-form fields of `TInput`. */
export type FormActionResult<
  TData extends object,
  TInput extends object,
> = ActionResult<TData, FormError<keyof TInput & string>>;

export const FALLBACK_FORM_MESSAGE = "Check the highlighted fields.";

/**
 * Server side: turn the zod error from re-parsing an action's input into a `FormError`.
 * Keeps the first message per field, which is the one the client resolver would show.
 */
export function formErrorFromZod<TInput>(
  error: z.ZodError<TInput>,
): FormError<keyof TInput & string> {
  const flat = z.flattenError(error);
  const fieldErrors: Partial<Record<keyof TInput & string, string>> = {};
  for (const key of Object.keys(flat.fieldErrors) as (keyof TInput &
    string)[]) {
    const first = (flat.fieldErrors as Record<string, string[] | undefined>)[
      key
    ]?.[0];
    if (first) fieldErrors[key] = first;
  }
  return { message: flat.formErrors[0] ?? FALLBACK_FORM_MESSAGE, fieldErrors };
}

/**
 * Client side (inside a `use-<name>.ts` hook only): put a server `FormError` onto the form.
 * Field messages go to their fields; the form-level message goes to `root.server` only when
 * no field explains the failure, so the user never sees the same problem twice.
 */
export function applyFormError<TValues extends FieldValues>(
  setError: UseFormSetError<TValues>,
  error: FormError<FieldPath<TValues>>,
): void {
  const fields = Object.keys(error.fieldErrors ?? {}) as FieldPath<TValues>[];
  let applied = 0;
  for (const name of fields) {
    const message = error.fieldErrors?.[name];
    if (!message) continue;
    setError(name, { type: "server", message }, { shouldFocus: applied === 0 });
    applied += 1;
  }
  if (applied === 0)
    setError("root.server", { type: "server", message: error.message });
}
