import type { FormEvent } from "react";
import type { Control, FieldErrors, UseFormRegister } from "react-hook-form";
import type { PathContent } from "@/engine/path";
import type { PackOption } from "@/server/packs/list-packs";
import type { GroupFormValues } from "../../schemas";

/** MF-0059: a path the form offers; only what the select and the notice show. */
export type PathOption = Pick<PathContent, "slug" | "name">;

export interface CreateGroupFormProps {
  packs: PackOption[];
  paths: readonly PathOption[];
}

export type GroupKind = GroupFormValues["kind"];

/**
 * Every field the form holds, whichever kind is chosen: the hidden kind's value stays in the form
 * and `GroupFormInput` strips it on submit.
 */
export interface GroupFormFields {
  kind: GroupKind;
  name: string;
  packSlug: string;
  pathSlug: string;
}

export interface UseCreateGroupFormReturn {
  control: Control<GroupFormValues>;
  register: UseFormRegister<GroupFormValues>;
  errors: FieldErrors<GroupFormFields>;
  onSubmit: (event?: FormEvent<HTMLFormElement>) => Promise<void>;
  isSubmitting: boolean;
  kind: GroupKind;
  /** Offer the Pack/Path choice only when there is a path to follow. */
  canChoosePath: boolean;
  /** The enroll notice under the path select, or null. */
  pathNotice: string | null;
}

export interface KindFieldProps {
  control: Control<GroupFormValues>;
}

export interface PackFieldProps {
  control: Control<GroupFormValues>;
  packs: PackOption[];
}

export interface PathFieldProps {
  control: Control<GroupFormValues>;
  paths: readonly PathOption[];
  notice: string | null;
}
