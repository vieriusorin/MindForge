import { describe, expect, it } from "vitest";
import { stormProof } from "../storm-proof";
import type { StormKind, StormResult, StormResultQuestion } from "../types";

const at = new Date("2026-11-20T10:00:00.000Z");
const q = (
  id: string,
  skillCode: string,
  correct: boolean | null,
  voided = false,
): StormResultQuestion => ({
  id,
  skillCode,
  chosen: correct === null ? null : ["A"],
  correct,
  voided,
});
const storm = (
  kind: StormKind,
  questions: StormResultQuestion[],
): StormResult => ({ kind, finishedAt: at, questions });

describe("stormProof", () => {
  it("a Boss-only proof is storm-proven but not Full-Storm-proven", () => {
    const proof = stormProof(
      [storm("boss", [q("q1", "D1.S1", true), q("q2", "D1.S1", true)])],
      new Set(),
    );
    expect(Object.fromEntries(proof)).toEqual({
      "D1.S1": { stormProven: true, fullStormProven: false },
    });
  });

  it("a Full Storm proof sets both", () => {
    const proof = stormProof(
      [storm("full", [q("q1", "D1.S1", true), q("q2", "D1.S1", true)])],
      new Set(),
    );
    expect(proof.get("D1.S1")).toEqual({
      stormProven: true,
      fullStormProven: true,
    });
  });

  it("one wrong or unanswered question leaves the skill unproven, and absent", () => {
    const proof = stormProof(
      [
        storm("full", [q("q1", "D1.S1", true), q("q2", "D1.S1", false)]),
        storm("boss", [q("q3", "D1.S2", true), q("q4", "D1.S2", null)]),
      ],
      new Set(),
    );
    expect(proof.size).toBe(0);
  });

  it("drops a question rejected later, so its wrong answer no longer blocks the proof", () => {
    const questions = [
      q("q1", "D1.S1", true),
      q("q2", "D1.S1", true),
      q("q3", "D1.S1", false),
    ];
    expect(stormProof([storm("full", questions)], new Set()).size).toBe(0);
    expect(
      stormProof([storm("full", questions)], new Set(["q3"])).get("D1.S1"),
    ).toEqual({
      stormProven: true,
      fullStormProven: true,
    });
  });

  it("ignores voided questions, which can neither prove nor block", () => {
    const proof = stormProof(
      [
        storm("full", [
          q("q1", "D1.S1", true),
          q("q2", "D1.S1", true),
          q("q3", "D1.S1", null, true),
        ]),
        storm("full", [q("q4", "D1.S2", true), q("q5", "D1.S2", null, true)]),
      ],
      new Set(),
    );
    expect([...proof.keys()]).toEqual(["D1.S1"]);
  });

  it("a proof in any storm counts, even after a later failed one", () => {
    const proof = stormProof(
      [
        storm("boss", [q("q1", "D1.S1", true), q("q2", "D1.S1", true)]),
        storm("full", [q("q3", "D1.S1", false), q("q4", "D1.S1", false)]),
      ],
      new Set(),
    );
    expect(proof.get("D1.S1")).toEqual({
      stormProven: true,
      fullStormProven: false,
    });
  });
});
