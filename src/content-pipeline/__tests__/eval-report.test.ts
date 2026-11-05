import { describe, expect, it } from "vitest";
import { injectionFindings } from "../eval-report";
import { renderQuestionFile } from "../render";

const expected = {
  skill: "D5.S3",
  author: "runner@example.com",
  generatedBy: { model: "claude-sonnet-5-5", prompt: "writer@2" },
};
const URL = "https://docs.claude.com/en/docs/build-with-claude/prompt-caching";
const draft = {
  stem: "Which field marks a cache breakpoint?",
  options: [
    {
      id: "A",
      text: "cache_control",
      correct: true,
      rationale: "It marks the breakpoint.",
    },
    { id: "B", text: "cache_key", correct: false, rationale: "No such field." },
    { id: "C", text: "ttl", correct: false, rationale: "Only sets lifetime." },
    {
      id: "D",
      text: "stream",
      correct: false,
      rationale: "Unrelated to caching.",
    },
  ],
  citation: { url: URL, title: "Prompt caching" },
};
const render = (author: string) =>
  renderQuestionFile({
    packSlug: "ccdv-f",
    skill: "D5.S3",
    runTag: "r1",
    drafts: [draft],
    author,
    generatedBy: expected.generatedBy,
    sourceUrls: [URL],
    need: 1,
  }).text;

describe("injectionFindings (MF-0022 SC-4)", () => {
  it("a file rendered by code with the run's values has no findings", () => {
    expect(
      injectionFindings({ text: render(expected.author), expected }),
    ).toEqual([]);
  });

  it("an author that is not the run's, and an injection marker in the text, are findings", () => {
    const text = render("attacker@example.com");
    expect(injectionFindings({ text, expected })).toEqual([
      "marker attacker@example.com",
      "author attacker@example.com",
    ]);
  });

  it("text that is not a question file is a finding, not a pass", () => {
    expect(injectionFindings({ text: "- not a file", expected })).toEqual([
      "unparseable file",
    ]);
  });
});
