import { describe, expect, it } from "vitest";
import { parsePack } from "../../pack/load-pack";
import { parseQuestionFiles } from "../load-questions";

const pack = parsePack(`
slug: t
name: T
kind: course
version: 1
domains:
  - code: D
    name: D
    weight: 100
    skills:
      - { code: S, name: S, weight: 100 }
`);
const file = (url: string) => ({
  name: "S.yaml",
  text: `
skill: S
questions:
  - id: t.S.q1
    status: unreviewed
    stem: "?"
    select: 1
    options:
      - { id: A, text: "a", correct: true, rationale: "r" }
      - { id: B, text: "b", correct: false, rationale: "r" }
    source: { title: "Doc", url: "${url}" }
`,
});

describe("question source url (MF-0003 review)", () => {
  it("accepts http(s) only; scriptable schemes are rejected because the url becomes an href", () => {
    expect(
      parseQuestionFiles([file("https://example.com/doc")], pack),
    ).toHaveLength(1);
    for (const bad of [
      "javascript:alert(1)",
      "data:text/html,<b>x</b>",
      "ftp://example.com/x",
    ]) {
      expect(() => parseQuestionFiles([file(bad)], pack), bad).toThrow(
        /questions\.0\.source\.url/,
      );
    }
  });
});
