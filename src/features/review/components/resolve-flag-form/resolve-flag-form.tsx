"use client";

import { Ban, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { useResolveFlagForm } from "./hooks/use-resolve-flag-form";
import type { ResolveFlagFormProps } from "./types";

export function ResolveFlagForm(props: ResolveFlagFormProps) {
  const { register, errors, onDismiss, onReject, pendingAction } =
    useResolveFlagForm(props);
  const fieldId = `resolve-${props.itemId}`;
  return (
    <form noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.comment)}>
          <FieldLabel htmlFor={fieldId}>
            Your decision, for the reviewers
          </FieldLabel>
          <Textarea
            id={fieldId}
            rows={3}
            aria-invalid={Boolean(errors.comment)}
            {...register("comment")}
          />
          <FieldError errors={errors.comment ? [errors.comment] : undefined} />
        </Field>
        <FieldError
          errors={errors.root?.server ? [errors.root.server] : undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onDismiss}
            disabled={pendingAction !== null}
          >
            <CheckCheck aria-hidden />
            {pendingAction === "dismiss" ? "Dismissing…" : "Dismiss flags"}
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onReject}
            disabled={pendingAction !== null}
          >
            <Ban aria-hidden />
            {pendingAction === "reject" ? "Rejecting…" : "Reject item"}
          </Button>
        </div>
      </FieldGroup>
    </form>
  );
}
