import { z } from "zod";

const SLUG = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase kebab-case");

/** MF-0058: `paths/<slug>.yaml`, an ordered list of course packs. */
export const PathFileSchema = z.strictObject({
  slug: SLUG,
  name: z.string().min(1),
  /** The page the order comes from (Anthropic's path). */
  source: z.url({ protocol: /^https$/ }),
  /** Pack slugs, in path order. */
  courses: z.array(SLUG).min(1).readonly(),
});
