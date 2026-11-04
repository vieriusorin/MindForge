import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { graphProblem } from "../diagrams";
import { codeCaughtFlaws, loadItemGoldenCases } from "../item-eval";
import type { DiagramDraft } from "../types";

const graph = (over: Partial<DiagramDraft> = {}): DiagramDraft => ({
  title: "t",
  direction: "LR",
  nodes: [
    { id: "A", label: "a", shape: "step" },
    { id: "B", label: "b", shape: "step" },
  ],
  edges: [{ from: "A", to: "B", label: "" }],
  sources: ["https://example.com/a"],
  ...over,
});

/** A draft as the raw record a golden file holds. */
const raw = (draft: DiagramDraft): Record<string, unknown> =>
  JSON.parse(JSON.stringify(draft));

describe("graphProblem (ADR 0003, same rules as the pack schema)", () => {
  it("accepts a drawable graph", () => {
    expect(graphProblem(graph())).toBeNull();
  });

  it("names the first problem: too few nodes, no edge, duplicate id, unknown end", () => {
    expect(
      graphProblem(graph({ nodes: [{ id: "A", label: "a", shape: "step" }] })),
    ).toMatch(/at least two nodes/);
    expect(graphProblem(graph({ edges: [] }))).toMatch(/at least one edge/);
    expect(
      graphProblem(
        graph({
          nodes: [
            { id: "A", label: "a", shape: "step" },
            { id: "A", label: "b", shape: "step" },
          ],
          edges: [{ from: "A", to: "A", label: "" }],
        }),
      ),
    ).toBe('duplicate node id "A"');
    expect(
      graphProblem(graph({ edges: [{ from: "Z", to: "B", label: "" }] })),
    ).toBe('edge to unknown node "Z"');
  });
});

describe("codeCaughtFlaws", () => {
  it("card: a missing, non-array, empty or blank-entry 'where it breaks' is empty-break", () => {
    for (const item of [
      {},
      { whereItBreaks: "one string" },
      { whereItBreaks: [] },
      { whereItBreaks: ["ok", ""] },
      { whereItBreaks: [3] },
    ])
      expect(codeCaughtFlaws("card", item)).toEqual(["empty-break"]);
    expect(codeCaughtFlaws("card", { whereItBreaks: ["specific"] })).toEqual(
      [],
    );
  });

  it("diagram: an undrawable or malformed graph is wrong-edge", () => {
    expect(codeCaughtFlaws("diagram", raw(graph()))).toEqual([]);
    expect(
      codeCaughtFlaws(
        "diagram",
        raw(graph({ edges: [{ from: "A", to: "Q", label: "" }] })),
      ),
    ).toEqual(["wrong-edge"]);
    expect(codeCaughtFlaws("diagram", { nodes: "x" })).toEqual(["wrong-edge"]);
  });
});

describe("loadItemGoldenCases", () => {
  const dirWith = (text: string): string => {
    const dir = mkdtempSync(join(tmpdir(), "golden-"));
    writeFileSync(join(dir, "a.yaml"), text);
    return dir;
  };

  it("reads the kind's item under its own key", () => {
    const cases = loadItemGoldenCases(
      dirWith(
        "cases:\n  - id: c1\n    flaw: generic-break\n    card: { id: x, whereItBreaks: [y] }\n",
      ),
      "card",
    );
    expect(cases).toEqual([
      {
        id: "c1",
        kind: "card",
        flaw: "generic-break",
        item: { id: "x", whereItBreaks: ["y"] },
      },
    ]);
  });

  it("refuses a duplicate id, a flaw of the other kind and a missing item", () => {
    expect(() =>
      loadItemGoldenCases(
        dirWith(
          "cases:\n  - { id: c1, flaw: null, card: {} }\n  - { id: c1, flaw: null, card: {} }\n",
        ),
        "card",
      ),
    ).toThrow(/duplicate/);
    expect(() =>
      loadItemGoldenCases(
        dirWith("cases:\n  - { id: c1, flaw: wrong-edge, card: {} }\n"),
        "card",
      ),
    ).toThrow();
    expect(() =>
      loadItemGoldenCases(
        dirWith("cases:\n  - { id: c1, flaw: null }\n"),
        "diagram",
      ),
    ).toThrow();
  });
});
