import { describe, expect, it } from "vitest";
import {
  isPnpmRefFile,
  PNPM_BUILTINS,
  unknownPnpmRefs,
} from "../../../scripts/lib/pnpm-refs.mjs";

const scripts = new Set(["test:db"]);

describe("isPnpmRefFile", () => {
  it.each([
    [".claude/hooks/stop-gate.mjs", { markdown: false }],
    [".claude/hooks/lib/gate-core.mjs", { markdown: false }],
    [".claude/settings.json", { markdown: false }],
    [".claude/agents/verifier.md", { markdown: true }],
    [".claude/rules/testing.md", { markdown: true }],
    [".claude/skills/tdd/references/x.md", { markdown: true }],
    ["CLAUDE.md", { markdown: true }],
    ["AGENTS.md", { markdown: true }],
    [".claude/hooks/README.md", null],
    [".claude/settings.local.json", null],
    ["docs/CLAUDE.md", null],
    ["scripts/check-hooks.mjs", null],
  ])("%s → %j", (rel, expected) => {
    expect(isPnpmRefFile(rel)).toEqual(expected);
  });
});

describe("unknownPnpmRefs", () => {
  it("reports two references on one line, in order", () => {
    expect(
      unknownPnpmRefs({
        text: "pnpm a:b && pnpm test:db && pnpm c",
        markdown: false,
        scripts,
      }),
    ).toEqual([
      { line: 1, name: "a:b" },
      { line: 1, name: "c" },
    ]);
  });

  it("reads CRLF text by line", () => {
    expect(
      unknownPnpmRefs({ text: "x\r\npnpm nope\r\n", markdown: false, scripts }),
    ).toEqual([{ line: 2, name: "nope" }]);
  });

  it("treats a ~~~ fence like a backtick fence, and a fence of the other char does not close it", () => {
    const text = ["~~~", "pnpm a", "```", "pnpm b", "~~~", "pnpm c"].join("\n");
    expect(unknownPnpmRefs({ text, markdown: true, scripts })).toEqual([
      { line: 2, name: "a" },
      { line: 4, name: "b" },
    ]);
  });

  it("runs an unclosed fence to the end of the file", () => {
    const text = ["```bash", "pnpm a", "", "pnpm b"].join("\n");
    expect(
      unknownPnpmRefs({ text, markdown: true, scripts }).map((r) => r.name),
    ).toEqual(["a", "b"]);
  });

  it("reads a double-backtick code span", () => {
    expect(
      unknownPnpmRefs({
        text: "Run ``pnpm nope `x` `` now",
        markdown: true,
        scripts,
      }),
    ).toEqual([{ line: 1, name: "nope" }]);
  });

  it("ignores Markdown prose but reads the same words as code", () => {
    expect(
      unknownPnpmRefs({ text: "pnpm nope", markdown: true, scripts }),
    ).toEqual([]);
    expect(
      unknownPnpmRefs({ text: "pnpm nope", markdown: false, scripts }),
    ).toEqual([{ line: 1, name: "nope" }]);
  });

  it("does not merge two separate code spans into one command (review N-3)", () => {
    expect(
      unknownPnpmRefs({
        text: "Use `pnpm` with `nope` later",
        markdown: true,
        scripts,
      }),
    ).toEqual([]);
  });

  it("reads a fence indented inside a list item, and closes it (review N-4)", () => {
    const text = [
      "1. Step:",
      "     ```bash",
      "     pnpm a",
      "     ```",
      "Prose pnpm b after the fence.",
    ].join("\n");
    expect(unknownPnpmRefs({ text, markdown: true, scripts })).toEqual([
      { line: 3, name: "a" },
    ]);
  });

  it("reads `pnpm <prefix>:*` as a family: known when a script has that prefix (review N-5)", () => {
    const withGates = new Set(["gate:planning"]);
    expect(
      unknownPnpmRefs({
        text: "run pnpm gate:* then pnpm nope:*",
        markdown: false,
        scripts: withGates,
      }),
    ).toEqual([{ line: 1, name: "nope:*" }]);
  });

  it("accepts every pnpm built-in", () => {
    const text = [...PNPM_BUILTINS].map((b) => `pnpm ${b}`).join("\n");
    expect(unknownPnpmRefs({ text, markdown: false, scripts })).toEqual([]);
  });
});
