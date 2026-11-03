"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useSignInForm } from "./hooks/use-sign-in-form";
import type { SignInFormProps } from "./types";

export function SignInForm({ next, linkError }: SignInFormProps) {
  const { state, formAction, isPending } = useSignInForm();

  if (state.status === "sent") {
    return (
      <output className="block rounded-lg bg-secondary p-4 text-secondary-foreground">
        Check <strong>{state.email}</strong> for a sign-in link.
      </output>
    );
  }

  const error =
    state.status === "error"
      ? state.message
      : linkError
        ? "That sign-in link is invalid or expired. Request a new one."
        : null;

  return (
    <form action={formAction}>
      <FieldGroup>
        <Field data-invalid={Boolean(error)}>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-invalid={Boolean(error)}
          />
          <FieldError errors={error ? [{ message: error }] : undefined} />
        </Field>
        {next && <input type="hidden" name="next" value={next} />}
        <Button type="submit" size="lg" disabled={isPending}>
          {isPending ? "Sending…" : "Send me a sign-in link"}
        </Button>
      </FieldGroup>
    </form>
  );
}
