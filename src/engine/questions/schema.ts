import { z } from "zod";

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
    status: z.enum(["official", "unreviewed"]),
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
