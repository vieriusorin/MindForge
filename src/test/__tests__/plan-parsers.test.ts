/** MF-0069 inner tests: the edges of `checkPlanParsers`' section reader (LOOP-PLAN `## Parsers`). */
import { describe, expect, it } from "vitest";
import { checkPlanParsers } from "../../../scripts/lib/planning-check.mjs";

const GOAL =
  "---\nticket_id: MF-9999\nstage: build\ngoal_status: in-progress\n---\n";

const tasks = (owns: unknown): string =>
  `\`\`\`json tasks\n${JSON.stringify([{ id: "T1", agent: "inline", owns }])}\n\`\`\`\n`;

const run = (body: string, owns: unknown = ["scripts/x.mjs"]): string[] =>
  checkPlanParsers([
    { dir: "MF-9999", goalText: GOAL, planText: `${body}\n\n${tasks(owns)}` },
  ]);

const TABLE = "| a | b |\n|---|---|\n| 1 | x |\n| 2 | y |\n| 3 | z |";
const block = (name: string, parts: { table?: string; extra?: string } = {}) =>
  `### ${name}\n\nAccepted grammar: x.\n\nRejected inputs:\n\n${parts.table ?? TABLE}\n\nExempt-path test: none: x.${parts.extra ?? ""}`;

describe("checkPlanParsers section reader", () => {
  it("accepts a heading with a suffix", () => {
    expect(run("## Parsers (none)\n\nNone: no parser.")).toEqual([]);
  });

  it("accepts prose between the Rejected inputs label and its table", () => {
    const b = block("A").replace(
      "Rejected inputs:\n\n",
      "Rejected inputs, one row each:\n\nSome words first.\n\n",
    );
    expect(run(`## Parsers\n\n${b}`)).toEqual([]);
  });

  it("does not count a header and separator alone as rows", () => {
    expect(
      run(`## Parsers\n\n${block("A", { table: "| a |\n|---|" })}`),
    ).toEqual([
      'MF-9999: Parsers block "A" has no Rejected inputs table with 3 or more rows',
    ]);
  });

  it("still judges blocks when None: is also present", () => {
    expect(run("## Parsers\n\nNone: nothing.\n\n### B\n\nprose")).toEqual([
      'MF-9999: Parsers block "B" has no "Accepted grammar:" line',
      'MF-9999: Parsers block "B" has no Rejected inputs table with 3 or more rows',
      'MF-9999: Parsers block "B" has no "Exempt-path test:" line',
    ]);
  });

  it("does not read a ### or ## line inside a fence as a heading", () => {
    const fenced = block("A", {
      extra: "\n\n```md\n### not a block\n## not a section\n```",
    });
    expect(run(`## Parsers\n\n${fenced}`)).toEqual([]);
  });

  it("reads bold labels, but a bold label with no text after it is missing", () => {
    const bold = block("A")
      .replace("Accepted grammar: x.", "**Accepted grammar:** x.")
      .replace("Exempt-path test: none: x.", "**Exempt-path test:**");
    expect(run(`## Parsers\n\n${bold}`)).toEqual([
      'MF-9999: Parsers block "A" has no "Exempt-path test:" line',
    ]);
  });

  it("judges a block with an empty name", () => {
    expect(run("## Parsers\n\n### \n\nprose")).toHaveLength(3);
  });

  it("ignores owns that are not arrays of strings", () => {
    expect(run("no section", "scripts/x.mjs")).toEqual([]);
    expect(run("no section", [42, { glob: "scripts/x" }])).toEqual([]);
  });

  it("names the first triggering glob in task order", () => {
    expect(run("no section", ["docs/a.md", "src/engine/b/**"])).toEqual([
      'MF-9999: LOOP-PLAN owns src/engine/b/** but has no "## Parsers" section (write "None: <reason>" or one ### block per parser)',
    ]);
  });

  // MF-0069 review B-1: loose substring matches let a block pass without a real declaration.
  it("B-1: a table under a later label does not count for Rejected inputs", () => {
    const b = `### P\n\nAccepted grammar: x.\n\nRejected inputs: see GOAL SC-3.\n\nCross-check:\n\n${TABLE}\n\nExempt-path test: none: x.`;
    expect(run(`## Parsers\n\n${b}`)).toEqual([
      'MF-9999: Parsers block "P" has no Rejected inputs table with 3 or more rows',
    ]);
  });

  it("B-1: labels and a table inside a fence do not count", () => {
    const b = `### P\n\n\`\`\`md\nAccepted grammar: x.\nRejected inputs:\n${TABLE}\nExempt-path test: none: x.\n\`\`\``;
    expect(run(`## Parsers\n\n${b}`)).toHaveLength(3);
  });

  it("B-1: a label inside a prose sentence does not count", () => {
    const b = `### P\n\nWe will write the Accepted grammar: TBD and the Exempt-path test: TBD later.\n\nRejected inputs:\n\n${TABLE}`;
    expect(run(`## Parsers\n\n${b}`)).toEqual([
      'MF-9999: Parsers block "P" has no "Accepted grammar:" line',
      'MF-9999: Parsers block "P" has no "Exempt-path test:" line',
    ]);
  });

  it("B-1: a list-item label counts", () => {
    const b = block("A")
      .replace("Accepted grammar:", "- Accepted grammar:")
      .replace("Exempt-path test:", "- **Exempt-path test:**");
    expect(run(`## Parsers\n\n${b}`)).toEqual([]);
  });

  // MF-0069 review B-2: a glob the trigger could not place was treated as outside parser territory (fail open).
  it.each([
    ["{scripts,docs}/x.mjs"],
    ["./scripts/x.mjs"],
    [".claude/**"],
    ["**/*.mjs"],
    ["src/{a,{b,c}}.ts"],
  ])("B-2: owns %s triggers the rule", (glob) => {
    expect(run("no section", [glob])).toHaveLength(1);
  });

  it("B-2: a __tests__ folder must be a whole path segment to exempt a glob", () => {
    expect(run("no section", ["scripts/my__tests__/x.mjs"])).toHaveLength(1);
    expect(run("no section", ["scripts/lib/__tests__/**"])).toEqual([]);
  });

  it("review: a placeholder None: <reason> is not a reason", () => {
    expect(run("## Parsers\n\nNone: <reason>")).toEqual([
      'MF-9999: Parsers section says "None:" without a reason',
    ]);
  });

  it("review: honest heading and None variants are read", () => {
    expect(run("##  Parsers\n\nNone: no parser.")).toEqual([]);
    expect(run("## Parsers:\n\nNone: no parser.")).toEqual([]);
    expect(run("## Parsers\n\n**None:** no parser.")).toEqual([]);
  });

  it("review: a ~~~ line inside a ``` fence does not close it", () => {
    const fenced = block("A", {
      extra: "\n\n```md\n~~~\n### hidden\n```\n\n### P\n\nprose",
    });
    expect(run(`## Parsers\n\n${fenced}`)).toHaveLength(3);
  });

  it("review: a # heading ends the section", () => {
    expect(run("## Parsers\n\nNone: ok.\n\n# Appendix\n\n### X")).toEqual([]);
  });

  it("ends the section at the next ## heading", () => {
    expect(
      run(`## Parsers\n\nNone: ok.\n\n## Steps\n\n### Not a parser block`),
    ).toEqual([]);
  });
});
