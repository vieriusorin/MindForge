import { z } from "zod";

/** MF-0065 (DQ-7): one pack's `misconceptions.yaml`. Structure only; references are checked in the parser. */
export const MisconceptionFileSchema = z.strictObject({
  misconceptions: z
    .array(
      z.strictObject({
        id: z
          .string()
          .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "id must be kebab-case"),
        label: z
          .string()
          .trim()
          .min(1, "a label says what the wrong belief is"),
        skill: z.string().min(1).optional(),
      }),
    )
    .min(1),
  tags: z.record(
    z.string().min(1),
    z.record(z.string().min(1), z.string().min(1)),
  ),
});
