import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  checkFrozenCollisions,
  findHits,
  parseBuildsOn,
  parseListedPaths,
  parseSymbols,
} from "../../../scripts/lib/frozen-collisions.mjs";

const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

function tree(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "mf0043-inner-"));
  roots.push(root);
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), content);
  }
  return root;
}

describe("parseSymbols", () => {
  it("returns null when the heading is absent", () => {
    expect(parseSymbols("# Plan\n\n## Steps\n\n- `toX`\n")).toBeNull();
  });

  it("marks a section that says None. as none", () => {
    expect(parseSymbols("## Symbols changed\n\nNone.\n")).toEqual({
      symbols: [],
      rejected: [],
      isNone: true,
    });
  });

  it("keeps names once each, and stops at the next heading of the same or a higher level", () => {
    const plan = [
      "## Symbols changed",
      "",
      "### Functions",
      "- `toPlayableQuestion` (gains a hash), `$state`",
      "### Types",
      "- `PackContent`, `toPlayableQuestion` again",
      "",
      "## Steps",
      "- `notASymbol`",
    ].join("\n");
    expect(parseSymbols(plan)).toEqual({
      symbols: ["toPlayableQuestion", "$state", "PackContent"],
      rejected: [],
      isNone: false,
    });
  });

  it("MF-0043 review B1: takes the leading name from a call, member or literal-index form, and keeps hyphenated literals", () => {
    const plan = [
      "## Symbols changed",
      "- `toPlayableQuestion(q)`, `toOther()`, `PackContent.items`, `ITEM_TYPES[number]`, `ROWS[0]`",
      "- members `not-in-pack`, `\"invalid-line\"`, `'exposed-secret'`",
    ].join("\n");
    expect(parseSymbols(plan)).toEqual({
      symbols: [
        "toPlayableQuestion",
        "toOther",
        "PackContent",
        "ITEM_TYPES",
        "ROWS",
        "not-in-pack",
        "invalid-line",
        "exposed-secret",
      ],
      rejected: [],
      isNone: false,
    });
  });

  it("MF-0043 re-review: rejects a generic, a name-index and a token holding two calls, instead of keeping only the outer name", () => {
    const plan = [
      "## Symbols changed",
      "- `Promise<PackContent>`, `Result<T>`, `MAP[Key]`, `f(a) and g(b)`",
    ].join("\n");
    expect(parseSymbols(plan)).toEqual({
      symbols: [],
      rejected: [
        "Promise<PackContent>",
        "Result<T>",
        "MAP[Key]",
        "f(a) and g(b)",
      ],
      isNone: false,
    });
  });

  it("MF-0043 review B1: rejects tokens it cannot match (commands, paths, placeholders, phrases)", () => {
    const plan = [
      "## Symbols changed",
      "- `pnpm ticket:collisions`, `src/a.ts`, `<each existing name>`, `two words`",
    ].join("\n");
    expect(parseSymbols(plan)).toEqual({
      symbols: [],
      rejected: [
        "pnpm ticket:collisions",
        "src/a.ts",
        "<each existing name>",
        "two words",
      ],
      isNone: false,
    });
  });
});

describe("checkFrozenCollisions input errors (MF-0043 review B1)", () => {
  const base = (symbols: string) => ({
    ".planning/tasks/MF-0500/GOAL.md": "---\nbuilds_on: []\n---\n",
    ".planning/tasks/MF-0500/LOOP-PLAN.md": `## Symbols changed\n\n${symbols}\n\n## Steps\n`,
    "src/a/__tests__/mf-0001-a.acceptance.test.ts":
      "const p = toPlayableQuestion(q);",
  });

  it("exits 2 naming a token it could not use, instead of reporting clean", () => {
    const root = tree(
      base("- `pnpm ticket:collisions` and `toPlayableQuestion(q)`"),
    );
    const result = checkFrozenCollisions({ root, ticket: "MF-0500" });
    expect(result.code).toBe(2);
    expect(result.message).toContain("`pnpm ticket:collisions`");
  });

  it("exits 2 when the section names nothing in backticks and does not say None.", () => {
    const root = tree(base("toPlayableQuestion gains a hash."));
    const result = checkFrozenCollisions({ root, ticket: "MF-0500" });
    expect(result.code).toBe(2);
    expect(result.message).toContain("None.");
  });

  it("checks the call form against the frozen file", () => {
    const root = tree(base("- `toPlayableQuestion(q)` gains a hash"));
    expect(checkFrozenCollisions({ root, ticket: "MF-0500" }).hits).toEqual([
      {
        path: "src/a/__tests__/mf-0001-a.acceptance.test.ts",
        line: 1,
        symbol: "toPlayableQuestion",
      },
    ]);
  });
});

describe("own-ticket exclusion (MF-0043 review minor)", () => {
  it("still scans a foreign file the ticket re-froze into its own manifest", () => {
    const FOREIGN = "src/f/__tests__/mf-0011-heatmap.acceptance.test.ts";
    const root = tree({
      ".planning/tasks/MF-0021/GOAL.md": "---\nbuilds_on: []\n---\n",
      ".planning/tasks/MF-0021/LOOP-PLAN.md":
        "## Symbols changed\n\n- `summarizeHeatmap`\n",
      ".planning/tasks/MF-0021/FROZEN.json": JSON.stringify({
        files: [{ path: FOREIGN }],
      }),
      ".planning/tasks/MF-0011/FROZEN.json": JSON.stringify({
        files: [{ path: FOREIGN }],
      }),
      [FOREIGN]: "summarizeHeatmap(rows);",
    });
    expect(
      checkFrozenCollisions({ root, ticket: "MF-0021" }).hits.map(
        (h) => h.path,
      ),
    ).toEqual([FOREIGN]);
  });
});

describe("parseListedPaths", () => {
  it("reads table rows, strips :line and :range, and ends the heading section at the next heading", () => {
    const plan = [
      "## Frozen files this will re-freeze",
      "| File | Change |",
      "|---|---|",
      '| `src/a/x.acceptance.test.ts:124-133` | `toX(q, "h")` |',
      "| `src/b/y.acceptance.test.tsx:70` | fixture |",
      "## Steps",
      "1. `src/c/z.acceptance.test.ts`",
    ].join("\n");
    expect(parseListedPaths(plan)).toEqual([
      "src/a/x.acceptance.test.ts",
      "src/b/y.acceptance.test.tsx",
    ]);
  });

  it("reads the bullet form over its indented continuation only", () => {
    const plan = [
      "- Frozen files this will re-freeze: `src/a/x.acceptance.test.ts`, and",
      "  `src/b/y.acceptance.test.ts` (fixture only).",
      "- Baseline red: `src/c/z.acceptance.test.ts`.",
    ].join("\n");
    expect(parseListedPaths(plan)).toEqual([
      "src/a/x.acceptance.test.ts",
      "src/b/y.acceptance.test.ts",
    ]);
  });

  it("returns [] when no section exists, and ignores backticks without a path", () => {
    expect(parseListedPaths("## Steps\n\n- `src/a.ts`\n")).toEqual([]);
    expect(
      parseListedPaths(
        "## Frozen files this will re-freeze\n\nNone. `toX` unchanged.\n",
      ),
    ).toEqual([]);
  });

  it("reads CRLF plans like LF", () => {
    expect(
      parseListedPaths(
        "## Frozen files this will re-freeze\r\n- `src/a/x.acceptance.test.ts:3`\r\n## Steps\r\n",
      ),
    ).toEqual(["src/a/x.acceptance.test.ts"]);
  });
});

describe("parseBuildsOn", () => {
  it("reads the front-matter list", () => {
    expect(
      parseBuildsOn(
        "---\nticket_id: MF-1\nbuilds_on: [MF-0003, MF-0016]\n---\n",
      ),
    ).toEqual(["MF-0003", "MF-0016"]);
  });

  it("returns [] for an empty or absent list", () => {
    expect(parseBuildsOn("---\nbuilds_on: []\n---\n")).toEqual([]);
    expect(parseBuildsOn("---\nticket_id: MF-1\n---\n")).toEqual([]);
  });
});

describe("findHits", () => {
  it("matches whole words only, with $ and _ as word characters", () => {
    const files = [
      {
        path: "b.ts",
        content: [
          "qs.map(toX)",
          "toXY(q)",
          "my_toX(q)",
          "$toX(q)",
          "const a = $state;",
          "const b = x$state;",
        ].join("\n"),
      },
    ];
    expect(findHits({ files, symbols: ["toX", "$state"] })).toEqual([
      { path: "b.ts", line: 1, symbol: "toX" },
      { path: "b.ts", line: 5, symbol: "$state" },
    ]);
  });

  it("counts CRLF lines like LF and sorts by path, then line, then symbol", () => {
    const files = [
      { path: "z.ts", content: "a\r\nb(toX, PackContent)\r\n" },
      { path: "a.ts", content: "toX" },
    ];
    expect(findHits({ files, symbols: ["toX", "PackContent"] })).toEqual([
      { path: "a.ts", line: 1, symbol: "toX" },
      { path: "z.ts", line: 2, symbol: "PackContent" },
      { path: "z.ts", line: 2, symbol: "toX" },
    ]);
  });
});

describe("findHits literals (MF-0043 review B3)", () => {
  it("matches a hyphenated literal whole, not inside a longer one", () => {
    const files = [
      {
        path: "a.ts",
        content: [
          'expect(r).toEqual(["not-in-pack"]);',
          "const s = 'not-in-packs';",
          "const t = `x-not-in-pack`;",
        ].join("\n"),
      },
    ];
    expect(findHits({ files, symbols: ["not-in-pack"] })).toEqual([
      { path: "a.ts", line: 1, symbol: "not-in-pack" },
    ]);
  });
});

describe("section ends (MF-0043 review B2)", () => {
  it("a Frozen files heading ends the Symbols section even one level deeper, and vice versa", () => {
    const plan = [
      "## Symbols changed",
      "- `toX`",
      "### Frozen files this will re-freeze",
      '| `src/a/x.acceptance.test.ts:3` | `toX(q, "h")` | ok |',
      "### Notes",
      "- `src/b/y.acceptance.test.ts`",
    ].join("\n");
    expect(parseSymbols(plan)).toEqual({
      symbols: ["toX"],
      rejected: [],
      isNone: false,
    });
    expect(parseListedPaths(plan)).toEqual(["src/a/x.acceptance.test.ts"]);
  });
});

describe("re-freeze section end (MF-0043 re-review)", () => {
  it("ends at any heading, so a path under a deeper subheading is not counted as listed", () => {
    const plan = [
      "## Frozen files this will re-freeze",
      "None.",
      "### Steps",
      "- `src/a/x.acceptance.test.ts`",
    ].join("\n");
    expect(parseListedPaths(plan)).toEqual([]);
  });
});
