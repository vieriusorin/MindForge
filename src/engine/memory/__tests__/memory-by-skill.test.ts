import { describe, expect, it } from "vitest";
import { memoryBySkill } from "../memory-by-skill";
import type { Attempt } from "../types";

const now = new Date("2026-11-20T10:00:00.000Z");
const attempt = (skillCode: string): Attempt => ({
  questionId: `${skillCode}.q1`,
  skillCode,
  correct: true,
  answeredAt: new Date("2026-11-19T10:00:00.000Z"),
});

describe("memoryBySkill storm proof", () => {
  it("keeps both proofs false without a proof map", () => {
    const memory = memoryBySkill([attempt("D1.S1")], now).get("D1.S1");
    expect(memory?.stormProven).toBe(false);
    expect(memory?.fullStormProven).toBe(false);
  });

  it("merges each skill's proof into its snapshot", () => {
    const memory = memoryBySkill(
      [attempt("D1.S1"), attempt("D1.S2"), attempt("D1.S3")],
      now,
      new Map([
        ["D1.S1", { stormProven: true, fullStormProven: false }],
        ["D1.S2", { stormProven: true, fullStormProven: true }],
      ]),
    );
    expect(memory.get("D1.S1")).toMatchObject({
      stormProven: true,
      fullStormProven: false,
    });
    expect(memory.get("D1.S2")).toMatchObject({
      stormProven: true,
      fullStormProven: true,
    });
    expect(memory.get("D1.S3")).toMatchObject({
      stormProven: false,
      fullStormProven: false,
    });
  });

  it("adds no snapshot for a proven skill that was never attempted", () => {
    const memory = memoryBySkill(
      [],
      now,
      new Map([["D1.S1", { stormProven: true, fullStormProven: true }]]),
    );
    expect(memory.size).toBe(0);
  });
});
