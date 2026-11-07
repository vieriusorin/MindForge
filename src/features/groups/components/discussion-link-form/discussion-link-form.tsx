"use client";

import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useDiscussionLinkForm } from "./hooks/use-discussion-link-form";
import type { DiscussionLinkFormProps } from "./types";

/** MF-0063: the group admin's form for the discussion link (an external chat). */
export function DiscussionLinkForm(props: DiscussionLinkFormProps) {
  const { register, errors, onSubmit, onRemove, isSubmitting, hasLink } =
    useDiscussionLinkForm(props);
  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Field data-invalid={Boolean(errors.url)}>
          <FieldLabel htmlFor="discussion-url">Chat link</FieldLabel>
          <Input
            id="discussion-url"
            type="url"
            inputMode="url"
            placeholder="https://"
            aria-invalid={Boolean(errors.url)}
            {...register("url")}
          />
          <FieldDescription>
            A Slack, Teams or Discord link your members can open.
          </FieldDescription>
          <FieldError errors={errors.url ? [errors.url] : undefined} />
        </Field>
        <FieldError
          errors={errors.root?.server ? [errors.root.server] : undefined}
        />
        <div className="flex flex-wrap gap-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Saving…" : "Save link"}
          </Button>
          {hasLink ? (
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={onRemove}
            >
              Remove link
            </Button>
          ) : null}
        </div>
      </FieldGroup>
    </form>
  );
}
