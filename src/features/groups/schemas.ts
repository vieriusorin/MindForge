import { z } from "zod";
import { InviteCode } from "@/lib/invite-code";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** The group name rule, one owner for the pack form, the path form and both actions. */
const GroupName = z
  .string()
  .trim()
  .min(1, "Give the group a name.")
  .max(80, "Keep the name under 80 characters.");

const PackSlug = z.string().regex(SLUG, "Pick a learning pack.");

const PathSlug = z.string().regex(SLUG, "Pick a path.");

/**
 * Shared by the form (zodResolver, UX) and the Server Action (re-parse, the real boundary).
 * Lives here, not in actions.ts: a "use server" file may export only async functions.
 */
export const CreateGroupInput = z.strictObject({
  name: GroupName,
  packSlug: PackSlug,
});

export type CreateGroupValues = z.input<typeof CreateGroupInput>;

/** MF-0059: `createPathGroup`'s input. The action checks the slug against the path registry. */
export const CreatePathGroupInput = z.strictObject({
  name: GroupName,
  pathSlug: PathSlug,
});

export type CreatePathGroupValues = z.input<typeof CreatePathGroupInput>;

/**
 * MF-0059: the create form, a pack-or-path choice. Non-strict objects on purpose: the other
 * kind's leftover field is stripped rather than an error, so the output (minus `kind`) is what
 * `CreateGroupInput` / `CreatePathGroupInput` accept.
 */
export const GroupFormInput = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("pack"), name: GroupName, packSlug: PackSlug }),
  z.object({ kind: z.literal("path"), name: GroupName, pathSlug: PathSlug }),
]);

export type GroupFormValues = z.input<typeof GroupFormInput>;

/** MF-0059: `joinGroup`'s input; the code shape is owned by the server read it shares. */
export const JoinGroupInput = z.strictObject({ code: InviteCode });

/**
 * MF-0059: `advanceGroupCourse`'s input. `fromPack` is the course the screen showed; the DB
 * refuses with 40001 when the group has moved since (stale tab).
 */
export const AdvanceGroupCourseInput = z.strictObject({
  groupId: z.uuid(),
  fromPack: PackSlug,
});
