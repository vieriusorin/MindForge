"use client";

import { Check, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { useReviewActions } from "./hooks/use-review-actions";
import type { ReviewActionsProps } from "./types";

export function ReviewActions(props: ReviewActionsProps) {
  const {
    register,
    errors,
    onSubmit,
    onApprove,
    isApproving,
    isFlagging,
    isSubmitting,
  } = useReviewActions(props);
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your verdict</CardTitle>
        <CardDescription>
          Two approvals from two reviewers approve it. One flag hides it until a
          maintainer looks.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <Button type="button" onClick={onApprove} disabled={isSubmitting}>
          <Check aria-hidden /> {isApproving ? "Approving…" : "Approve"}
        </Button>
        <Separator />
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Field data-invalid={Boolean(errors.comment)}>
              <FieldLabel htmlFor="flag-comment">What is wrong?</FieldLabel>
              <Textarea
                id="flag-comment"
                rows={4}
                aria-invalid={Boolean(errors.comment)}
                {...register("comment")}
              />
              <FieldDescription>
                Maintainers read this. Cite the doc if you can.
              </FieldDescription>
              <FieldError
                errors={errors.comment ? [errors.comment] : undefined}
              />
            </Field>
            <FieldError
              errors={errors.root?.server ? [errors.root.server] : undefined}
            />
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              <Flag aria-hidden /> {isFlagging ? "Flagging…" : "Flag"}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
