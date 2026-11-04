import { z } from "zod";
import { AuthorSchema, OriginSchema, refineAuthor } from "../content/origin";

const OptionSchema = z.strictObject({
  id: z.string().regex(/^[A-Z]$/, "single capital letter"),
  text: z.string().min(1),
  correct: z.boolean(),
  rationale: z.string().trim().min(1, "every option needs a rationale"),
});

const QuestionSchema = z
  .strictObject({
    id: z
      .string()
      .regex(
        /^[a-z0-9-]+\.[A-Za-z0-9.]+\.[a-z0-9-]+$/,
        "pattern <pack>.<skill>.<name>",
      ),
    // MF-0006: `status` mixed provenance with trust; it is now `origin` (+ `author`).
    status: z
      .unknown()
      .optional()
      .refine((v) => v === undefined, {
        message:
          "`status` was renamed to `origin` (official | human | ai), with `author` for human/ai",
      }),
    origin: OriginSchema,
    author: AuthorSchema.optional(),
    // MF-0008: which model and prompt version wrote an `ai` item. Never sent to the browser.
    generatedBy: z
      .strictObject({
        model: z.string().trim().min(1),
        prompt: z.string().trim().min(1),
      })
      .optional(),
    stem: z.string().min(1),
    select: z.number().int().min(1),
    options: z.array(OptionSchema).min(2).max(6),
    // http(s) only: the url is rendered as an href (MF-0003 review)
    source: z.strictObject({
      title: z.string().min(1),
      url: z.url({ protocol: /^https?$/ }),
    }),
  })
  .superRefine((q, ctx) => {
    refineAuthor(q, ctx);
    if (q.generatedBy !== undefined && q.origin !== "ai")
      ctx.addIssue({
        code: "custom",
        path: ["generatedBy"],
        message: `generatedBy is only for ai items, not ${q.origin}`,
      });
    const correct = q.options.filter((o) => o.correct).length;
    if (correct !== q.select) {
      ctx.addIssue({
        code: "custom",
        path: ["select"],
        message: `select is ${q.select} but ${correct} option(s) are correct`,
      });
    }
    const seen = new Set<string>();
    q.options.forEach((o, j) => {
      if (seen.has(o.id))
        ctx.addIssue({
          code: "custom",
          path: ["options", j, "id"],
          message: `duplicate option id "${o.id}"`,
        });
      seen.add(o.id);
    });
  });

export const QuestionFileSchema = z.strictObject({
  skill: z.string().min(1),
  questions: z.array(QuestionSchema).min(1),
});

export type QuestionFileData = z.infer<typeof QuestionFileSchema>;
