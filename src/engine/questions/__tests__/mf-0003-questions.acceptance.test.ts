import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadPackFile, parsePack } from "../../pack/load-pack";
import { loadPackQuestions, parseQuestionFiles } from "../load-questions";
import { toPlayableQuestion } from "../playable";

const ROOT = process.cwd();

const PACK = parsePack(`
slug: tiny
name: Tiny
kind: course
version: 1
domains:
  - code: D1
    name: One
    weight: 100
    skills:
      - { code: S1, name: A, weight: 60 }
      - { code: S2, name: B, weight: 40 }
`);

const question = (over: string): string => `
skill: S1
questions:
  - id: tiny.S1.q1
    origin: ai
    author: author@example.com
    stem: "Which?"
    select: 1
    options:
      - { id: A, text: "a", correct: false, rationale: "no" }
      - { id: B, text: "b", correct: true, rationale: "yes" }
    source: { title: "Doc", url: "https://example.com/doc" }
${over}`;

const file = (text: string, name = "S1.yaml") => ({ name, text });

describe("MF-0003 question format", () => {
  it("SC-1: valid file loads; each rule violation names its path", () => {
    expect(parseQuestionFiles([file(question(""))], PACK)).toHaveLength(1);

    const wrongSelect = question("").replace("select: 1", "select: 2");
    expect(() => parseQuestionFiles([file(wrongSelect)], PACK)).toThrow(
      /questions\.0\.select/,
    );

    const dupOption = question("").replace(
      '{ id: B, text: "b"',
      '{ id: A, text: "b"',
    );
    expect(() => parseQuestionFiles([file(dupOption)], PACK)).toThrow(
      /questions\.0\.options\.1\.id/,
    );

    const unknownSkill = question("").replace("skill: S1", "skill: S9");
    expect(() => parseQuestionFiles([file(unknownSkill)], PACK)).toThrow(
      /skill/,
    );

    const emptyRationale = question("").replace(
      'rationale: "no"',
      'rationale: ""',
    );
    expect(() => parseQuestionFiles([file(emptyRationale)], PACK)).toThrow(
      /questions\.0\.options\.0\.rationale/,
    );

    const noUrl = question("").replace(', url: "https://example.com/doc"', "");
    expect(() => parseQuestionFiles([file(noUrl)], PACK)).toThrow(
      /questions\.0\.source\.url/,
    );

    const second = question("").replace("skill: S1", "skill: S2");
    expect(() =>
      parseQuestionFiles([file(question("")), file(second, "S2.yaml")], PACK),
    ).toThrow(/S2\.yaml[\s\S]*questions\.0\.id/);
  });

  it("SC-2: CCDV-F content: 3 official samples with the guide's keys, >= 2 questions per skill", async () => {
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const questions = await loadPackQuestions(
      pack,
      join(ROOT, "packs/ccdv-f/questions"),
    );

    const official = questions.filter((q) => q.origin === "official");
    const keyOf = (id: string): string[] =>
      (official.find((q) => q.id === id)?.options ?? [])
        .filter((o) => o.correct)
        .map((o) => o.id);
    expect(official.map((q) => q.id).sort()).toEqual([
      "ccdv-f.D2.S3.official-1",
      "ccdv-f.D7.S1.official-1",
      "ccdv-f.D8.S3.official-1",
    ]);
    expect(keyOf("ccdv-f.D2.S3.official-1")).toEqual(["B"]);
    expect(keyOf("ccdv-f.D7.S1.official-1")).toEqual(["B"]);
    expect(keyOf("ccdv-f.D8.S3.official-1")).toEqual(["B"]);

    const skills = pack.domains.flatMap((d) => d.skills.map((s) => s.code));
    expect(skills).toHaveLength(25);
    for (const code of skills) {
      expect({
        code,
        n: questions.filter((q) => q.skillCode === code).length >= 2,
      }).toEqual({ code, n: true });
    }
    expect(
      questions
        .filter((q) => q.origin !== "official")
        .every((q) => q.origin === "ai"),
    ).toBe(true);
  });

  it("SC-6: the playable DTO never carries correctness or rationale", async () => {
    const pack = await loadPackFile(join(ROOT, "packs/ccdv-f/pack.yaml"));
    const questions = await loadPackQuestions(
      pack,
      join(ROOT, "packs/ccdv-f/questions"),
    );
    expect(questions.length).toBeGreaterThanOrEqual(53);
    for (const q of questions) {
      const p = toPlayableQuestion(q);
      expect(Object.keys(p).sort()).toEqual([
        "id",
        "options",
        "origin",
        "select",
        "skillCode",
        "source",
        "stem",
      ]);
      for (const o of p.options)
        expect(Object.keys(o).sort()).toEqual(["id", "text"]);
      const json = JSON.stringify(p);
      for (const o of q.options) expect(json.includes(o.rationale)).toBe(false);
    }
  });
});
