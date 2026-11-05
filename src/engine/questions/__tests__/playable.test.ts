import { describe, expect, it } from "vitest";
import { toPlayableQuestions } from "../playable";
import type { Question } from "../types";

const q = (id: string): Question => ({
  id,
  skillCode: "S1",
  origin: "official",
  stem: `Stem ${id}`,
  select: 1,
  options: [{ id: "A", text: "First", correct: true, rationale: "Yes" }],
  source: { title: "Docs", url: "https://example.com" },
});

describe("toPlayableQuestions (MF-0032)", () => {
  it("binds each question to its deployed hash and keeps the order", () => {
    expect(
      toPlayableQuestions([q("b"), q("a")], { a: "ha", b: "hb" }).map((p) => [
        p.id,
        p.contentHash,
      ]),
    ).toEqual([
      ["b", "hb"],
      ["a", "ha"],
    ]);
  });

  it("drops a question with no deployed hash instead of serving it unbound", () => {
    expect(
      toPlayableQuestions([q("a"), q("b")], { b: "hb" }).map((p) => p.id),
    ).toEqual(["b"]);
  });
});
