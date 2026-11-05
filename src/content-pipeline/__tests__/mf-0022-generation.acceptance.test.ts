/**
 * MF-0022 acceptance (frozen): SC-2 pack-agnostic generation prompts with the MF-0039 drafter checks,
 * SC-3 the real-model eval decision. Expected values are literals from GOAL.md.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { judgeEvalSet } from "../eval-report";
import { loadItemGoldenCases } from "../item-eval";
import { fillPrompt, parsePrompt } from "../prompts";
import { loadGoldenCases } from "../verifier";
import { buildWriterBatch } from "../writer";

const ROOT = process.cwd();
const GENERATION_PROMPTS = ["writer", "nature-card", "diagram"] as const;
const PACK_NAME = "Introduction to Subagents";

const readPrompt = (name: string) =>
  parsePrompt(readFileSync(join(ROOT, "prompts", `${name}.md`), "utf8"));

describe("MF-0022 SC-2: pack-agnostic generation prompts", () => {
  it("SC-2: writer, nature-card and diagram hold {{packName}} and no 'Certified' literal", () => {
    for (const name of GENERATION_PROMPTS) {
      const body = readPrompt(name).body;
      expect(body, name).toContain("{{packName}}");
      expect(body, name).not.toMatch(/Certified/);
    }
  });

  it("SC-2: fillPrompt fills the pack name, keeps name and version, leaves no placeholder", () => {
    for (const name of GENERATION_PROMPTS) {
      const prompt = readPrompt(name);
      const filled = fillPrompt(prompt, { packName: PACK_NAME });
      expect(filled.name).toBe(prompt.name);
      expect(filled.version).toBe(prompt.version);
      expect(filled.body, name).toContain(PACK_NAME);
      expect(filled.body, name).not.toContain("{{");
    }
  });

  it("SC-2: fillPrompt throws on a placeholder it has no value for", () => {
    expect(() =>
      fillPrompt(
        { name: "x", version: 1, body: "For {{packName}} and {{audience}}." },
        { packName: PACK_NAME },
      ),
    ).toThrow(/\{\{audience\}\}/);
  });

  it("SC-2: each body has the 'Before you answer, check:' block naming the four drafter checks", () => {
    for (const name of GENERATION_PROMPTS) {
      const body = readPrompt(name).body;
      expect(body, name).toContain("Before you answer, check:");
      for (const word of [
        "strictest",
        "exception",
        "table row",
        "the page's reason",
      ])
        expect(body, `${name}: ${word}`).toContain(word);
    }
  });

  it("SC-2: a writer request for the subagents pack names that pack, not the CCDV-F exam", () => {
    const prompt = fillPrompt(readPrompt("writer"), { packName: PACK_NAME });
    const [request] = buildWriterBatch({
      skill: { code: "D1.S1", name: "Any skill" },
      corpus: [],
      request: 1,
      existingStems: [],
      prompt,
    });
    const systemText = (request?.params.system ?? [])
      .map((b) => b.text)
      .join("\n");
    expect(systemText).toContain(PACK_NAME);
    expect(systemText).not.toContain("Certified Developer");
  });
});

describe("MF-0022 SC-3: the eval decision", () => {
  const QUESTION_BAR = {
    "wrong-key": 1,
    "missing-rationale": 0.8,
    "wrong-citation": 0.8,
  };
  const DIAGRAM_BAR = {
    "wrong-edge": 0.8,
    "factual-error": 0.8,
    "wrong-citation": 0.8,
  };

  const questionCases = [
    { id: "clean-1", flaw: null },
    { id: "wk-1", flaw: "wrong-key" },
    { id: "wk-2", flaw: "wrong-key" },
    { id: "wk-3", flaw: "wrong-key" },
    { id: "mr-1", flaw: "missing-rationale" },
    { id: "mr-2", flaw: "missing-rationale" },
    { id: "mr-3", flaw: "missing-rationale" },
    { id: "wc-1", flaw: "wrong-citation" },
    { id: "wc-2", flaw: "wrong-citation" },
    { id: "wc-3", flaw: "wrong-citation" },
  ];
  const allCaught = new Map<string, string[]>(
    questionCases.map((c) => [c.id, c.flaw === null ? [] : [c.flaw]]),
  );

  it("SC-3: every planted flaw caught and no false alarm → every type pass, set passed", () => {
    const report = judgeEvalSet({
      set: "questions",
      cases: questionCases,
      found: allCaught,
      passRate: QUESTION_BAR,
    });
    expect(report.set).toBe("questions");
    expect(report.passed).toBe(true);
    expect(report.falseAlarms).toEqual([]);
    expect(report.flaws).toEqual([
      { flaw: "wrong-key", planted: 3, caught: 3, status: "pass" },
      { flaw: "missing-rationale", planted: 3, caught: 3, status: "pass" },
      { flaw: "wrong-citation", planted: 3, caught: 3, status: "pass" },
    ]);
  });

  it("SC-3: one clean case flagged → false alarm listed, set fails", () => {
    const found = new Map(allCaught);
    found.set("clean-1", ["wrong-citation"]);
    const report = judgeEvalSet({
      set: "questions",
      cases: questionCases,
      found,
      passRate: QUESTION_BAR,
    });
    expect(report.falseAlarms).toEqual(["clean-1"]);
    expect(report.passed).toBe(false);
  });

  it("SC-3: 2 of 3 caught against a 0.8 bar → that type fails, set fails", () => {
    const found = new Map(allCaught);
    found.set("mr-3", []);
    const report = judgeEvalSet({
      set: "questions",
      cases: questionCases,
      found,
      passRate: QUESTION_BAR,
    });
    expect(report.flaws.find((f) => f.flaw === "missing-rationale")).toEqual({
      flaw: "missing-rationale",
      planted: 3,
      caught: 2,
      status: "fail",
    });
    expect(report.passed).toBe(false);
  });

  it("SC-3: a case with no verdict is a miss; a different flaw found is not a catch", () => {
    const found = new Map(allCaught);
    found.delete("wk-1");
    found.set("wk-2", ["wrong-citation"]);
    const report = judgeEvalSet({
      set: "questions",
      cases: questionCases,
      found,
      passRate: QUESTION_BAR,
    });
    expect(report.flaws.find((f) => f.flaw === "wrong-key")).toEqual({
      flaw: "wrong-key",
      planted: 3,
      caught: 1,
      status: "fail",
    });
    expect(report.falseAlarms).toEqual([]);
    expect(report.passed).toBe(false);
  });

  it("SC-3: a flaw type with 0 planted is 'untested' and does not fail the set", () => {
    const report = judgeEvalSet({
      set: "diagrams",
      cases: [
        { id: "d-clean", flaw: null },
        { id: "d-edge", flaw: "wrong-edge" },
        { id: "d-fact", flaw: "factual-error" },
      ],
      found: new Map([
        ["d-clean", []],
        ["d-edge", ["wrong-edge"]],
        ["d-fact", ["factual-error"]],
      ]),
      passRate: DIAGRAM_BAR,
    });
    expect(report.flaws.find((f) => f.flaw === "wrong-citation")).toEqual({
      flaw: "wrong-citation",
      planted: 0,
      caught: 0,
      status: "untested",
    });
    expect(report.passed).toBe(true);
  });

  it("SC-3: the shipped golden files with no verdicts → every planted type fails; diagrams wrong-citation untested", () => {
    const questions = judgeEvalSet({
      set: "questions",
      cases: loadGoldenCases(join(ROOT, "evals", "golden")),
      found: new Map(),
      passRate: QUESTION_BAR,
    });
    expect(questions.flaws.map((f) => [f.flaw, f.planted, f.status])).toEqual([
      ["wrong-key", 3, "fail"],
      ["missing-rationale", 3, "fail"],
      ["wrong-citation", 3, "fail"],
    ]);
    const diagrams = judgeEvalSet({
      set: "diagrams",
      cases: loadItemGoldenCases(
        join(ROOT, "evals", "golden", "diagrams"),
        "diagram",
      ),
      found: new Map(),
      passRate: DIAGRAM_BAR,
    });
    expect(diagrams.flaws.map((f) => [f.flaw, f.planted, f.status])).toEqual([
      ["wrong-edge", 1, "fail"],
      ["factual-error", 1, "fail"],
      ["wrong-citation", 0, "untested"],
    ]);
    expect(diagrams.passed).toBe(false);
  });
});
