import type { FormEvent } from "react";
import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { DiscussionLinkFormValues } from "../../schemas";

export interface DiscussionLinkFormProps {
  groupId: string;
  /** The link the group has now, or null. */
  currentUrl: string | null;
}

export interface UseDiscussionLinkFormReturn {
  register: UseFormRegister<DiscussionLinkFormValues>;
  errors: FieldErrors<DiscussionLinkFormValues>;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  /** Clears the group's link (sends an empty url). */
  onRemove: () => void;
  isSubmitting: boolean;
  /** Offer Remove only when the group has a link. */
  hasLink: boolean;
}
