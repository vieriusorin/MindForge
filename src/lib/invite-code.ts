import { z } from "zod";

/**
 * MF-0002 invite codes (`private.new_invite_code`: a uuid without dashes). One owner for the server read
 * (`getInvitePreview`) and the join action's input schema, which the client imports too, so it lives
 * in `lib`, not `src/server` (state-and-data.md §2).
 */
export const InviteCode = z.string().regex(/^[0-9a-f]{16,64}$/);
