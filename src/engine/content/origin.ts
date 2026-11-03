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
