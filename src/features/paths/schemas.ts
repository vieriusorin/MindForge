import { z } from "zod";

/** MF-0058: which path to start or leave. Shared by the actions (re-parse) and their callers. */
export const PathSlugInput = z.strictObject({
  pathSlug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
});

export type PathSlugValues = z.infer<typeof PathSlugInput>;
