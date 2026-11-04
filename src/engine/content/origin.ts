import { z } from "zod";

/** Shared by every item type: questions, nature cards, diagrams (CONTEXT.md Origin, Author). */
export const OriginSchema = z.enum(["official", "human", "ai"]);

/** The author's sign-in email. */
export const AuthorSchema = z.email();

/** `author` is required for human/ai items and absent for official ones (copied from the guide). */
export function refineAuthor(
  item: { origin: z.infer<typeof OriginSchema>; author?: string | undefined },
  ctx: z.RefinementCtx,
): void {
  if (item.origin === "official" && item.author !== undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["author"],
      message: "official items have no author",
    });
  }
  if (item.origin !== "official" && item.author === undefined) {
    ctx.addIssue({
      code: "custom",
      path: ["author"],
      message: `${item.origin} items need an author (sign-in email)`,
    });
  }
}

/** MF-0008 / MF-0014: which model and prompt version wrote an `ai` item. Never sent to the browser. */
export const GeneratedBySchema = z.strictObject({
  model: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
});

/** `generatedBy` belongs to `ai` items only: a model id on a human or official item is wrong (CONTEXT.md Origin). */
export function refineGeneratedBy(
  item: {
    origin: z.infer<typeof OriginSchema>;
    generatedBy?: z.infer<typeof GeneratedBySchema> | undefined;
  },
  ctx: z.RefinementCtx,
): void {
  if (item.generatedBy !== undefined && item.origin !== "ai")
    ctx.addIssue({
      code: "custom",
      path: ["generatedBy"],
      message: `generatedBy is only for ai items, not ${item.origin}`,
    });
}
