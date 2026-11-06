/**
 * MF-0041 acceptance (frozen): the flaw-key rule of `pnpm check:packs`. In a cuckoo whose lines carry
 * numeric list labels, a `flawLine` that differs from the flaw line's label needs a human
 * `# flaw-line: <n> — "<fragment of the keyed line>" — <reason>` note. Expected values come from GOAL.md
 * SC-1…SC-6, the edge-input table and D-6, not from the checker. Fixtures are inline YAML, so the file
 * runs without `.cache/corpus` (CI).
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkFlawKeys } from "../../../scripts/lib/cuckoo-flaw-key.mjs";

const ROOT = resolve(__dirname, "../../..");
const SOURCE = "https://example.com/context-engineering";

interface Item {
  id: string;
  lines: string[];
  flawLine: number;
  comments?: string[];
}

/** One cuckoo file as the pack stores it; comments sit inside the item's block. */
function file(...items: Item[]): string {
  const blocks = items.map((c) =>
    [
      `  - id: ${c.id}`,
      ...(c.comments ?? []).map((line) => `    ${line}`),
      "    title: A snippet",
      "    origin: ai",
      "    author: a@example.com",
      "    snippetKind: prompt",
      "    lines:",
      ...c.lines.map((l) => `      - ${JSON.stringify(l)}`),
      `    flawLine: ${c.flawLine}`,
      "    flawKind: false-claim",
      "    explanation: Why the flaw is wrong.",
      "    sources:",
      `      - ${SOURCE}`,
    ].join("\n"),
  );
  return `skill: S1\ncuckoos:\n${blocks.join("\n")}\n`;
}

const check = (text: string) =>
  checkFlawKeys({ file: "packs/p/cuckoos/S1.yaml", text });

// The real D6.S1 shape: a heading on line 1, so every label trails its 1-based index by one.
const D6S1_LINES = [
  "Context policy:",
  "1. Keep a running NOTES.md with decisions and open questions; re-read it after a reset.",
  "2. Fetch files when you need them; keep paths, not contents, in your notes.",
  "3. Never clear old tool results: the more tokens in context, the more accurate you become.",
  "4. When the history nears the limit, summarise it and continue from the summary.",
];
const ID = "p.S1.cuckoo-keep-every-tool-result";
const PRE_FIX: Item = { id: ID, lines: D6S1_LINES, flawLine: 3 };
const FIXED: Item = { id: ID, lines: D6S1_LINES, flawLine: 4 };
const NOTE =
  '# flaw-line: 4 — "Never clear old tool results" — line 1 is a heading, labels trail the index by 1';

describe("MF-0041 flaw-key rule", () => {
  it("SC-1: the pre-fix D6.S1 key (flawLine 3, label 2) fails, naming the label and the fix", () => {
    const problems = check(file(PRE_FIX));
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatchObject({ id: ID, line: 3, rule: "flaw-key" });
    expect(problems[0].message).toContain("2");
    expect(problems[0].message).toContain("# flaw-line:");
  });

  it("SC-2: the fixed key (flawLine 4, label 3) fails without the note", () => {
    expect(check(file(FIXED))).toEqual([
      expect.objectContaining({ id: ID, line: 4, rule: "flaw-key" }),
    ]);
  });

  it("SC-2: the fixed key passes with a note quoting the keyed line", () => {
    expect(check(file({ ...FIXED, comments: [NOTE] }))).toEqual([]);
  });

  it("SC-2: `--` is accepted in place of `—`", () => {
    const note =
      '# flaw-line: 4 -- "Never clear old tool results" -- heading on line 1, labels trail by 1';
    expect(check(file({ ...FIXED, comments: [note] }))).toEqual([]);
  });

  it("SC-3: no labelled line, or exactly one, never fires", () => {
    expect(
      check(
        file({
          id: "p.a",
          lines: ["Plain.", "Also plain.", "Flaw."],
          flawLine: 3,
        }),
      ),
    ).toEqual([]);
    expect(
      check(
        file({
          id: "p.b",
          lines: ["Intro:", "1. Only label.", "Flaw."],
          flawLine: 2,
        }),
      ),
    ).toEqual([]);
  });

  it("SC-3: an unlabelled flaw line does not fire, even among labelled lines", () => {
    expect(
      check(
        file({
          id: "p.c",
          lines: ["1. One.", "2. Two.", "Heading that is false."],
          flawLine: 3,
        }),
      ),
    ).toEqual([]);
  });

  it("SC-3: a label equal to flawLine needs no note", () => {
    expect(
      check(
        file({
          id: "p.d",
          lines: ["1. One.", "2. Two.", "3. Three."],
          flawLine: 2,
        }),
      ),
    ).toEqual([]);
  });

  it("SC-3: `2)` labels, indented labels and two-digit labels count", () => {
    expect(
      check(
        file({
          id: "p.e",
          lines: ["Steps:", "1) One.", "2) Two."],
          flawLine: 3,
        }),
      ),
    ).toEqual([
      expect.objectContaining({ id: "p.e", line: 3, rule: "flaw-key" }),
    ]);
    expect(
      check(
        file({
          id: "p.f",
          lines: ["Steps:", "  1. One.", "  2. Two."],
          flawLine: 3,
        }),
      ),
    ).toEqual([
      expect.objectContaining({ id: "p.f", line: 3, rule: "flaw-key" }),
    ]);
    const ten = [
      "Steps:",
      ...Array.from({ length: 10 }, (_, i) => `${i + 1}. Step ${i + 1}.`),
    ];
    expect(check(file({ id: "p.g", lines: ten, flawLine: 11 }))).toEqual([
      expect.objectContaining({ id: "p.g", line: 11, rule: "flaw-key" }),
    ]);
  });

  it("SC-3: a number without a space after the dot is not a label", () => {
    expect(
      check(
        file({
          id: "p.h",
          lines: ["Limits:", "1.5 GB per file.", "2.0 is the version."],
          flawLine: 3,
        }),
      ),
    ).toEqual([]);
  });

  it("SC-3: an out-of-range flawLine is left to the schema", () => {
    expect(
      check(
        file({
          id: "p.i",
          lines: ["1. One.", "2. Two.", "3. Three."],
          flawLine: 9,
        }),
      ),
    ).toEqual([]);
  });

  it("SC-4: a note whose number is not flawLine fails", () => {
    const note =
      '# flaw-line: 3 — "Never clear old tool results" — labels trail by 1';
    expect(check(file({ ...FIXED, comments: [note] }))).toContainEqual(
      expect.objectContaining({ id: ID, rule: "flaw-key" }),
    );
  });

  it("SC-4: a note with no reason, or without the quoted fragment, fails", () => {
    for (const note of [
      '# flaw-line: 4 — "Never clear old tool results" —',
      '# flaw-line: 4 — "Never clear old tool results"',
      "# flaw-line: 4 — labels trail the index by 1",
      "# flaw-line: 4",
    ]) {
      expect(check(file({ ...FIXED, comments: [note] })), note).toContainEqual(
        expect.objectContaining({ id: ID, rule: "flaw-key" }),
      );
    }
  });

  it("SC-4: a fragment that is not in the keyed line fails", () => {
    const note =
      '# flaw-line: 4 — "Fetch files when you need them" — labels trail by 1';
    expect(check(file({ ...FIXED, comments: [note] }))).toContainEqual(
      expect.objectContaining({ id: ID, rule: "flaw-key" }),
    );
  });

  it("SC-4: the fragment match is case-sensitive", () => {
    const note =
      '# flaw-line: 4 — "never clear old tool results" — labels trail by 1';
    expect(check(file({ ...FIXED, comments: [note] }))).toContainEqual(
      expect.objectContaining({ id: ID, rule: "flaw-key" }),
    );
  });

  it("SC-4: a fragment that also occurs in another line fails", () => {
    const note = '# flaw-line: 4 — "in context, the" — labels trail by 1';
    const lines = [
      ...D6S1_LINES.slice(0, 4),
      "4. What is in context, the model attends to.",
    ];
    expect(
      check(file({ id: ID, lines, flawLine: 4, comments: [note] })),
    ).toContainEqual(expect.objectContaining({ id: ID, rule: "flaw-key" }));
  });

  it("SC-4: a fragment of fewer than three words fails", () => {
    const note = '# flaw-line: 4 — "Never clear" — labels trail by 1';
    expect(check(file({ ...FIXED, comments: [note] }))).toContainEqual(
      expect.objectContaining({ id: ID, rule: "flaw-key" }),
    );
  });

  it("SC-4: a note on an item where the rule does not fire is stale", () => {
    const item: Item = {
      id: "p.j",
      lines: ["1. One.", "2. Two is the false step.", "3. Three."],
      flawLine: 2,
      comments: ['# flaw-line: 2 — "Two is the false step" — label matches'],
    };
    expect(check(file(item))).toContainEqual(
      expect.objectContaining({ id: "p.j", rule: "flaw-key" }),
    );
  });

  it("SC-4: notes are per item, not per file", () => {
    const other: Item = { id: "p.k", lines: ["Plain.", "Flaw."], flawLine: 2 };
    expect(check(file({ ...other, comments: [NOTE] }))).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "p.k", rule: "flaw-key" }),
      ]),
    );
    expect(check(file({ ...other, comments: [NOTE] }, FIXED))).toContainEqual(
      expect.objectContaining({ id: ID, line: 4, rule: "flaw-key" }),
    );
  });

  describe("SC-5: pnpm check:packs runs the rule", () => {
    const dir = mkdtempSync(join(tmpdir(), "mf-0041-"));
    afterAll(() => rmSync(dir, { recursive: true, force: true }));

    it("SC-5: a fixture pack with a mis-keyed numbered cuckoo exits 1 and prints the flaw-key problem", () => {
      const cuckoos = join(dir, "fixture", "cuckoos");
      mkdirSync(cuckoos, { recursive: true });
      // Clean for every other rule: no absolute word, no backtick, the source exempted.
      const text = file({
        id: "fixture.S1.cuckoo-steps",
        lines: [
          "Steps:",
          "1. Read the ticket.",
          "2. Write the test.",
          "3. Skip the review and merge.",
        ],
        flawLine: 3,
        comments: [`# uncached: ${SOURCE} — fixture, no corpus`],
      });
      writeFileSync(join(cuckoos, "S1.yaml"), text);
      const run = spawnSync(
        process.execPath,
        [join(ROOT, "scripts/check-pack-grounding.mjs")],
        {
          cwd: ROOT,
          env: { ...process.env, MF_PACKS_DIR: dir },
          encoding: "utf8",
        },
      );
      expect(run.status).toBe(1);
      expect(run.stderr).toContain("fixture.S1.cuckoo-steps");
      expect(run.stderr).toContain("# flaw-line:");
    });
  });

  it("SC-6: every shipped cuckoo passes the flaw-key rule", () => {
    const packs = join(ROOT, "packs");
    const problems = readdirSync(packs).flatMap((pack) => {
      const dir = join(packs, pack, "cuckoos");
      let names: string[];
      try {
        names = readdirSync(dir).filter((n) => n.endsWith(".yaml"));
      } catch {
        return [];
      }
      return names.flatMap((n) =>
        checkFlawKeys({
          file: `packs/${pack}/cuckoos/${n}`,
          text: readFileSync(join(dir, n), "utf8"),
        }),
      );
    });
    expect(problems).toEqual([]);
  });
});
