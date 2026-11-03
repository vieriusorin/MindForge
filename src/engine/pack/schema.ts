import { z } from "zod";

/** Weights in a pack are percentages rounded to one decimal, so sums may drift by rounding. */
export const WEIGHT_TOLERANCE = 0.05;

const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);
const near = (a: number, b: number): boolean =>
  Math.abs(a - b) <= WEIGHT_TOLERANCE;

const SkillSchema = z.strictObject({
  code: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive(),
  description: z.string().optional(),
  /** MF-0006: official doc URLs for this skill, the corpus the AI writers draw from (MF-0008). */
  sources: z
    .array(z.url({ protocol: /^https$/ }))
    .min(1)
    .optional(),
});

const DomainSchema = z.strictObject({
  code: z.string().min(1),
  name: z.string().min(1),
  weight: z.number().positive(),
  skills: z.array(SkillSchema).min(1),
});

const ExamMetaSchema = z.strictObject({
  code: z.string().min(1),
  questions: z.number().int().positive(),
  minutes: z.number().int().positive(),
  passScaled: z.number(),
  scaleMin: z.number(),
  scaleMax: z.number(),
  /** MF-0006: ISO date of the exam, for readiness (MF-0015). */
  date: z.iso.date().optional(),
});

export const PackSchema = z
  .strictObject({
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "lowercase kebab-case"),
    name: z.string().min(1),
    kind: z.enum(["exam", "course", "onboarding"]),
    version: z.number().int().positive(),
    source: z
      .strictObject({ title: z.string().min(1), url: z.url().optional() })
      .optional(),
    exam: ExamMetaSchema.optional(),
    domains: z.array(DomainSchema).min(1),
  })
  .superRefine((pack, ctx) => {
    const domainCodes = new Set<string>();
    const skillCodes = new Set<string>();
    pack.domains.forEach((domain, i) => {
      if (domainCodes.has(domain.code)) {
        ctx.addIssue({
          code: "custom",
          path: ["domains", i, "code"],
          message: `duplicate domain code "${domain.code}"`,
        });
      }
      domainCodes.add(domain.code);
      domain.skills.forEach((skill, j) => {
        if (skillCodes.has(skill.code)) {
          ctx.addIssue({
            code: "custom",
            path: ["domains", i, "skills", j, "code"],
            message: `duplicate skill code "${skill.code}"`,
          });
        }
        skillCodes.add(skill.code);
      });
      const skillTotal = sum(domain.skills.map((s) => s.weight));
      if (!near(skillTotal, domain.weight)) {
        ctx.addIssue({
          code: "custom",
          path: ["domains", i, "skills"],
          message: `skill weights sum to ${skillTotal.toFixed(2)}, domain weight is ${domain.weight}`,
        });
      }
    });
    const domainTotal = sum(pack.domains.map((d) => d.weight));
    if (!near(domainTotal, 100)) {
      ctx.addIssue({
        code: "custom",
        path: ["domains"],
        message: `domain weights sum to ${domainTotal.toFixed(2)}, expected 100`,
      });
    }
    if (pack.kind === "exam" && !pack.exam) {
      ctx.addIssue({
        code: "custom",
        path: ["exam"],
        message: "exam packs need exam metadata",
      });
    }
  });
