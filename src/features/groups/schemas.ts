import { z } from "zod";

/**
 * Shared by the form (zodResolver, UX) and the Server Action (re-parse, the real boundary).
 * Lives here, not in actions.ts: a "use server" file may export only async functions.
 */
export const CreateGroupInput = z.strictObject({
  name: z
    .string()
    .trim()
    .min(1, "Give the group a name.")
    .max(80, "Keep the name under 80 characters."),
  packSlug: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Pick a learning pack."),
});

export type CreateGroupValues = z.input<typeof CreateGroupInput>;
