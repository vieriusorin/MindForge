/**
 * MF-0043 acceptance (frozen): `pnpm ticket:collisions <ID>` reports every frozen-file line that uses a symbol
 * the plan changes, unless the plan's "Frozen files this will re-freeze" section already names that file.
 * Expected values come from GOAL.md SC-1…SC-5, never from the checker.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkFrozenCollisions } from "../../../scripts/lib/frozen-collisions.mjs";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** A repo-shaped temp tree: { "repo/relative/path": content }. */
function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "mf0043-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

/** File content with the given 1-based lines set and every other line a filler comment. */
function atLines(lines: Record<number, string>, total: number): string {
  return Array.from(
    { length: total },
    (_, i) => lines[i + 1] ?? `// line ${i + 1}`,
  ).join("\n");
}

const goal = (id: string, buildsOn: string[]): string =>
  `---\nticket_id: ${id}\ntier: normal\nstage: plan\nbuilds_on: [${buildsOn.join(", ")}]\n---\n\n## Objective\n\nText.\n`;

const MF0008 =
  "src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts";
const MF0003 =
  "src/engine/questions/__tests__/mf-0003-questions.acceptance.test.ts";

// The pre-MF-0032 lines (bd4e1dc / da583a0), verbatim at their real line numbers.
const PRE_MF0032 = {
  [MF0008]: atLines(
    {
      10: 'import { parseQuestionFiles, toPlayableQuestion } from "..";',
      70: "    const playable = toPlayableQuestion(q);",
    },
    101,
  ),
  [MF0003]: atLines(
    {
      5: 'import { toPlayableQuestion } from "../playable";',
      124: "      const p = toPlayableQuestion(q);",
    },
    140,
  ),
};

const SYMBOLS =
  "## Symbols changed\n\n- `toPlayableQuestion` (gains a required content hash)\n";

// MF-0032 LOOP-PLAN's re-freeze table rows, verbatim.
const ROW_MF0003 =
  '| `src/engine/questions/__tests__/mf-0003-questions.acceptance.test.ts:124-133` | `toPlayableQuestion(q, "h")`; expected keys add `"contentHash"` | C-2, user-approved |';
const ROW_MF0012 =
  // biome-ignore lint/suspicious/noTemplateCurlyInString: verbatim plan text; `${id}` is markdown, not a placeholder
  "| `src/features/duel/components/duel-session/__tests__/mf-0012-duel.acceptance.test.tsx:14-25` | fixture adds `contentHash: \\`h-${id}\\`` | C-2, user-approved |";
const ROW_MF0008 =
  '| `src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts:70` | `toPlayableQuestion(q, "h")` (the two `not.toContain` assertions stay) | **new, needs approval** |';

const refreezeTable = (rows: string[]): string =>
  `### Frozen files this will re-freeze (one batch, at plan approval)\n\n| File | Change | Reason |\n|---|---|---|\n${rows.join("\n")}\n`;

function mf0032Repo(rows: string[], extra: Record<string, string> = {}) {
  return tree({
    ".planning/tasks/MF-0032/GOAL.md": goal("MF-0032", [
      "MF-0003",
      "MF-0007",
      "MF-0009",
      "MF-0016",
    ]),
    ".planning/tasks/MF-0032/LOOP-PLAN.md": `# Loop Plan\n\n${SYMBOLS}\n${refreezeTable(rows)}\n## Steps\n\n1. Do it.\n`,
    ...PRE_MF0032,
    ...extra,
  });
}

describe("MF-0043 frozen-collision check", () => {
  it("SC-1: the MF-0032 proof case is RED: the unlisted MF-0008 call and import are reported, exit 1", () => {
    const root = mf0032Repo([ROW_MF0003, ROW_MF0012]);
    const result = checkFrozenCollisions({ root, ticket: "MF-0032" });
    expect(result.code).toBe(1);
    expect(result.hits).toEqual([
      { path: MF0008, line: 10, symbol: "toPlayableQuestion" },
      { path: MF0008, line: 70, symbol: "toPlayableQuestion" },
    ]);
  });

  it("SC-2: with the MF-0008 row listed, nothing is reported, exit 0", () => {
    const root = mf0032Repo([ROW_MF0003, ROW_MF0012, ROW_MF0008]);
    const result = checkFrozenCollisions({ root, ticket: "MF-0032" });
    expect(result.code).toBe(0);
    expect(result.hits).toEqual([]);
  });

  it("SC-3: a file named by a bullet, a 'holds' row, or the bullet form of the section counts as listed; a path named only elsewhere does not", () => {
    const A = "src/a/__tests__/mf-0100-a.acceptance.test.ts";
    const B = "src/b/__tests__/mf-0101-b.acceptance.test.ts";
    const C = "src/c/__tests__/mf-0102-c.acceptance.test.ts";
    const D = "src/d/__tests__/mf-0103-d.acceptance.test.ts";
    const uses = "const x = toPlayableQuestion(q);";
    const files = { [A]: uses, [B]: uses, [C]: uses, [D]: uses };

    const headingForm = tree({
      ".planning/tasks/MF-0200/GOAL.md": goal("MF-0200", []),
      ".planning/tasks/MF-0200/LOOP-PLAN.md": [
        SYMBOLS,
        "## Frozen files this will re-freeze",
        "",
        `- \`${A}\`: fixture adds a hash.`,
        "",
        "| File:line | Assertion | Why it holds |",
        "|---|---|---|",
        `| \`${B}:1\` | key set | unchanged |`,
        "",
        "## Steps",
        "",
        `1. Also touches \`${C}\`.`,
      ].join("\n"),
      ...files,
    });
    expect(
      checkFrozenCollisions({ root: headingForm, ticket: "MF-0200" }).hits.map(
        (h) => h.path,
      ),
    ).toEqual([C, D]);

    const bulletForm = tree({
      ".planning/tasks/MF-0201/GOAL.md": goal("MF-0201", []),
      ".planning/tasks/MF-0201/LOOP-PLAN.md": [
        "## Discovery summary",
        "",
        SYMBOLS,
        "## Discovery notes",
        "",
        `- Frozen files this will re-freeze: none except \`${A}\`, and`,
        `  \`${B}\` (fixture only).`,
        `- Baseline red: \`${C}\` belongs to another ticket.`,
      ].join("\n"),
      ...files,
    });
    expect(
      checkFrozenCollisions({ root: bulletForm, ticket: "MF-0201" }).hits.map(
        (h) => h.path,
      ),
    ).toEqual([C, D]);
  });

  it("SC-4: scans builds_on FROZEN.json paths and acceptance files, skips node_modules and the ticket's own files, matches whole words, counts CRLF lines like LF", () => {
    const LOCK = "src/x/__tests__/helper-lock.test.ts";
    const OWN_PREFIX = "src/test/__tests__/mf-0300-own.acceptance.test.ts";
    const OWN_FROZEN = "src/y/__tests__/renamed-own.acceptance.test.ts";
    const REF = "src/z/__tests__/mf-0110-ref.acceptance.test.ts";
    const CRLF = "src/w/__tests__/mf-0111-crlf.acceptance.test.ts";
    const root = tree({
      ".planning/tasks/MF-0300/GOAL.md": goal("MF-0300", ["MF-0110"]),
      ".planning/tasks/MF-0300/FROZEN.json": JSON.stringify({
        ticket: "MF-0300",
        files: [{ path: OWN_FROZEN, sha256: "x", first_failure: "x" }],
      }),
      ".planning/tasks/MF-0300/LOOP-PLAN.md": `${SYMBOLS}\n## Frozen files this will re-freeze\n\nNone.\n`,
      ".planning/tasks/MF-0110/FROZEN.json": JSON.stringify({
        ticket: "MF-0110",
        files: [{ path: LOCK, sha256: "x", first_failure: "x" }],
      }),
      [LOCK]: "line one\nexpect(toPlayableQuestion(q)).toEqual(x);",
      "node_modules/pkg/__tests__/vendor.acceptance.test.ts":
        "toPlayableQuestion(q);",
      [OWN_PREFIX]: "toPlayableQuestion(q);",
      [OWN_FROZEN]: "toPlayableQuestion(q);",
      [REF]: [
        "const all = qs.map(toPlayableQuestion);",
        "const other = toPlayableQuestionX(q);",
        "const also = myToPlayableQuestion(q);",
      ].join("\n"),
      [CRLF]: "// one\r\n// two\r\nconst p = toPlayableQuestion(q);\r\n",
    });
    const result = checkFrozenCollisions({ root, ticket: "MF-0300" });
    expect(result.code).toBe(1);
    expect(result.hits).toEqual([
      { path: CRLF, line: 3, symbol: "toPlayableQuestion" },
      { path: LOCK, line: 2, symbol: "toPlayableQuestion" },
      { path: REF, line: 1, symbol: "toPlayableQuestion" },
    ]);
  });

  it("SC-5: an unknown ticket, a missing LOOP-PLAN.md or a missing Symbols changed heading exits 2 naming the path; 'None.' exits 0", () => {
    const empty = tree({ "README.md": "x" });
    const unknown = checkFrozenCollisions({ root: empty, ticket: "MF-9999" });
    expect(unknown.code).toBe(2);
    expect(unknown.message).toContain(".planning/tasks/MF-9999");

    const noPlan = tree({
      ".planning/tasks/MF-0400/GOAL.md": goal("MF-0400", []),
    });
    const missingPlan = checkFrozenCollisions({
      root: noPlan,
      ticket: "MF-0400",
    });
    expect(missingPlan.code).toBe(2);
    expect(missingPlan.message).toContain(
      ".planning/tasks/MF-0400/LOOP-PLAN.md",
    );

    const noHeading = tree({
      ".planning/tasks/MF-0401/GOAL.md": goal("MF-0401", []),
      ".planning/tasks/MF-0401/LOOP-PLAN.md":
        "# Loop Plan\n\n## Steps\n\n1. x\n",
    });
    const missingHeading = checkFrozenCollisions({
      root: noHeading,
      ticket: "MF-0401",
    });
    expect(missingHeading.code).toBe(2);
    expect(missingHeading.message).toContain("## Symbols changed");

    const none = tree({
      ".planning/tasks/MF-0402/GOAL.md": goal("MF-0402", []),
      ".planning/tasks/MF-0402/LOOP-PLAN.md":
        "## Symbols changed\n\nNone.\n\n## Steps\n",
      [MF0008]: PRE_MF0032[MF0008],
    });
    const nothing = checkFrozenCollisions({ root: none, ticket: "MF-0402" });
    expect(nothing.code).toBe(0);
    expect(nothing.hits).toEqual([]);
  });
});
