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

/** MF-0063: the longest discussion link the DB accepts (`groups_discussion_url_check`). */
export const DISCUSSION_URL_MAX = 500;

/**
 * MF-0063: the same rule as the DB CHECK in `20261106160000_mf0063_discussion_link.sql`, so
 * change both together. https only; an ASCII host with no user-info, so the host the card shows
 * is the one the link opens; an optional port; then /, ? or # and no whitespace or control
 * characters. `URL.canParse` is a zod-only tightening the CHECK can't express (review finding 1):
 * a port over 65535 or an invalid IPv4 host would otherwise save and then render nothing. The two
 * rules agree on ASCII; on unicode edges (U+FEFF, astral characters, tab trimming) the CHECK is the
 * looser one, so zod refuses first.
 */
const HTTPS_LINK =
  /^https:\/\/[A-Za-z0-9.-]+(:[0-9]{1,5})?([/?#][^\s\p{Cc}]*)?$/u;

export const DISCUSSION_URL_MESSAGE =
  "Use an https:// link, up to 500 characters.";

/** MF-0063: a discussion link, trimmed; "" (or only spaces) is `null`, which clears the link. */
export const DiscussionUrl = z
  .string()
  .trim()
  .refine(
    (url) =>
      url === "" ||
      (url.length <= DISCUSSION_URL_MAX &&
        HTTPS_LINK.test(url) &&
        URL.canParse(url)),
    DISCUSSION_URL_MESSAGE,
  )
  .transform((url) => (url === "" ? null : url));

/** MF-0063: the admin's discussion link form. */
export const DiscussionLinkFormInput = z.strictObject({ url: DiscussionUrl });

export type DiscussionLinkFormValues = z.input<typeof DiscussionLinkFormInput>;

/** MF-0063: `setGroupDiscussionLink`'s input: the form's values plus the group. */
export const SetDiscussionLinkInput = z.strictObject({
  groupId: z.uuid(),
  url: DiscussionUrl,
});
