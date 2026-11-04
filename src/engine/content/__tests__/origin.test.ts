import { describe, expect, it } from "vitest";
import { z } from "zod";
import { GeneratedBySchema, OriginSchema, refineGeneratedBy } from "../origin";

const Item = z
  .strictObject({
    origin: OriginSchema,
    generatedBy: GeneratedBySchema.optional(),
  })
  .superRefine(refineGeneratedBy);

const generatedBy = { model: "claude-sonnet-5-5", prompt: "diagram@1" };

describe("generatedBy (MF-0008 questions, MF-0014 cards and diagrams)", () => {
  it("is optional and accepted on ai items", () => {
    expect(Item.safeParse({ origin: "ai" }).success).toBe(true);
    expect(Item.safeParse({ origin: "ai", generatedBy }).success).toBe(true);
  });

  it("is refused on human and official items, at the generatedBy path", () => {
    for (const origin of ["human", "official"] as const) {
      const result = Item.safeParse({ origin, generatedBy });
      expect(result.success).toBe(false);
      expect(result.error?.issues[0]?.path).toEqual(["generatedBy"]);
      expect(result.error?.issues[0]?.message).toBe(
        `generatedBy is only for ai items, not ${origin}`,
      );
    }
  });

  it("holds exactly a non-empty model and prompt", () => {
    for (const bad of [
      { model: "m" },
      { model: " ", prompt: "p@1" },
      { ...generatedBy, temperature: 1 },
    ])
      expect(Item.safeParse({ origin: "ai", generatedBy: bad }).success).toBe(
        false,
      );
  });
});
