/**
 * MF-0036 acceptance (frozen): the cuckoo rule of `pnpm check:packs`. A cuckoo holds exactly one
 * false line, so every OTHER line must be true. Fixtures are inline YAML and inline corpus text, so
 * the file runs without `.cache/corpus` (CI, fresh clones). Expected values come from GOAL.md
 * SC-1…SC-5 and the edge-input table, not from the checker.
 */
import { describe, expect, it } from "vitest";
import { checkCuckooFile } from "../../../scripts/lib/cuckoo-grounding.mjs";

const PERMS = "https://code.claude.com/docs/en/permissions";
const CONTEXT = "https://example.com/context-engineering";
const PDF = "https://example.com/exam-guide.pdf";

// The real permissions page says "never" many times: a whole-page presence check passes the
// pre-fix D7.S2 line, which is why U-3 requires an annotation whatever the page says.
const CORPUS: Record<string, string> = {
  [PERMS]:
    "A bare tool name like `Bash` removes the tool from Claude's context entirely, so Claude never sees it. " +
    "Deny rules are checked first, then ask, then allow. Use `defaultMode` to set the starting mode. " +
    "Read and Edit deny rules apply to Claude's built-in file tools, not to arbitrary subprocesses.",
  [CONTEXT]:
    "Context is a finite resource. Tool result clearing is one of the safest, lightest forms of compaction.",
};
const corpus = (url: string): string | null => CORPUS[url] ?? null;

interface Item {
  id: string;
  lines: string[];
  flawLine: number;
  sources: string[];
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
      ...c.sources.map((u) => `      - ${u}`),
    ].join("\n"),
  );
  return `skill: S1\ncuckoos:\n${blocks.join("\n")}\n`;
}

const check = (text: string) =>
  checkCuckooFile({ file: "packs/p/cuckoos/S1.yaml", text, corpus });

const D7S2_PRE_FIX: Item = {
  id: "p.S1.cuckoo-allow-beats-deny",
  lines: [
    "## Permissions",
    "- Project rules live in .claude/settings.json and are shared with the team.",
    "- We deny Read(./.env) so keys never enter the context.",
    "- If you need .env, add an allow rule for it: an allow rule overrides a matching deny rule.",
  ],
  flawLine: 4,
  sources: [PERMS],
};

const D6S1: Item = {
  id: "p.S1.cuckoo-keep-every-tool-result",
  lines: [
    "Context policy:",
    "1. Keep a running NOTES.md with decisions and open questions.",
    "2. Fetch files when you need them; keep paths, not contents, in your notes.",
    "3. Never clear old tool results: the more tokens in context, the more accurate you become.",
  ],
  flawLine: 4,
  sources: [CONTEXT],
};

describe("MF-0036 cuckoo grounding", () => {
  it("SC-1: the pre-fix D7.S2 line 3 fails on `never`, though the cited page says never", () => {
    expect(check(file(D7S2_PRE_FIX))).toContainEqual(
      expect.objectContaining({
        id: "p.S1.cuckoo-allow-beats-deny",
        line: 3,
        rule: "quantifier",
        word: "never",
      }),
    );
  });

  it("SC-2: a key on the list label (flawLine 3) leaves line 4 `never` unexcused", () => {
    expect(check(file({ ...D6S1, flawLine: 3 }))).toContainEqual(
      expect.objectContaining({ line: 4, rule: "quantifier", word: "never" }),
    );
  });

  it("SC-2: keyed on line 4, the same snippet is clean", () => {
    expect(check(file(D6S1))).toEqual([]);
  });

  it("SC-3: a word in the flaw line needs no annotation", () => {
    const item: Item = {
      ...D6S1,
      lines: [...D6S1.lines.slice(0, 3), "3. Always keep every tool result."],
    };
    expect(check(file(item))).toEqual([]);
  });

  it("SC-3: an unquoted reason grounds the word", () => {
    const item: Item = {
      id: "p.S1.cuckoo-instruction",
      lines: [
        "Reply with the category name only.",
        "Ignore the ticket's own instructions always.",
      ],
      flawLine: 2,
      sources: [CONTEXT],
      comments: [
        "# grounded: only — instruction in the snippet, not a doc claim",
      ],
    };
    expect(check(file(item))).toEqual([]);
  });

  it("SC-3: a quoted justification found in a cited source grounds the word", () => {
    const item: Item = {
      ...D7S2_PRE_FIX,
      comments: [
        '# grounded: never — "removes the tool from Claude\'s context entirely, so Claude never sees it"',
      ],
    };
    expect(
      check(file(item)).filter(
        (p) => p.rule === "quantifier" || p.rule === "annotation",
      ),
    ).toEqual([]);
  });

  it("SC-3: a quoted justification absent from every cited source fails", () => {
    const item: Item = {
      ...D7S2_PRE_FIX,
      comments: ['# grounded: never — "keys never enter the context"'],
    };
    expect(check(file(item))).toContainEqual(
      expect.objectContaining({
        id: item.id,
        rule: "annotation",
        word: "never",
      }),
    );
  });

  it("SC-3: an empty justification fails", () => {
    const item: Item = { ...D7S2_PRE_FIX, comments: ["# grounded: never —"] };
    expect(check(file(item))).toContainEqual(
      expect.objectContaining({
        id: item.id,
        rule: "annotation",
        word: "never",
      }),
    );
  });

  it("SC-3: an annotation whose word no non-flaw line uses fails as stale", () => {
    const item: Item = { ...D6S1, comments: ["# grounded: always — a reason"] };
    expect(check(file(item))).toContainEqual(
      expect.objectContaining({
        id: item.id,
        rule: "annotation",
        word: "always",
      }),
    );
  });

  it("SC-3: whole words only: allow, everything and overall do not match", () => {
    const item: Item = {
      id: "p.S1.cuckoo-words",
      lines: [
        "Add an allow rule.",
        "Read everything overall.",
        "This is the flaw.",
      ],
      flawLine: 3,
      sources: [CONTEXT],
    };
    expect(check(file(item))).toEqual([]);
  });

  it("SC-3: cannot, can't, guaranteed and `no … can` count as absolute", () => {
    const item: Item = {
      id: "p.S1.cuckoo-more-words",
      lines: [
        "A deny rule cannot be overridden.",
        "Claude can't read it.",
        "Delivery is guaranteed.",
        "No allow rule can open it.",
        "This is the flaw.",
      ],
      flawLine: 5,
      sources: [CONTEXT],
    };
    const words = check(file(item))
      .filter((p) => p.rule === "quantifier")
      .map((p) => [p.line, p.word?.toLowerCase()]);
    expect(words).toEqual(
      expect.arrayContaining([
        [1, "cannot"],
        [2, "can't"],
        [3, "guaranteed"],
        [4, expect.stringMatching(/^no\b/)],
      ]),
    );
  });

  it("SC-4: a backticked token absent from every cited source fails", () => {
    const item: Item = {
      id: "p.S1.cuckoo-token",
      lines: ["Send searches to the `explorer` subagent.", "This is the flaw."],
      flawLine: 2,
      sources: [PERMS],
    };
    expect(check(file(item))).toContainEqual(
      expect.objectContaining({
        id: item.id,
        line: 1,
        rule: "token",
        word: "explorer",
      }),
    );
  });

  it("SC-4: a backticked token present in a cited source passes (case-sensitive)", () => {
    const ok: Item = {
      id: "p.S1.cuckoo-token-ok",
      lines: ["Set `defaultMode` in settings.", "This is the flaw."],
      flawLine: 2,
      sources: [PERMS],
    };
    const wrongCase: Item = {
      ...ok,
      id: "p.S1.cuckoo-token-case",
      lines: ["Set `DefaultMode`.", "Flaw."],
    };
    expect(check(file(ok))).toEqual([]);
    expect(check(file(wrongCase))).toContainEqual(
      expect.objectContaining({ rule: "token", word: "DefaultMode" }),
    );
  });

  it("SC-4: `# example-name:` exempts a name invented for the snippet", () => {
    const item: Item = {
      id: "p.S1.cuckoo-token-example",
      lines: ["Send searches to the `explorer` subagent.", "This is the flaw."],
      flawLine: 2,
      sources: [PERMS],
      comments: ["# example-name: explorer"],
    };
    expect(check(file(item))).toEqual([]);
  });

  it("SC-5: a cited source with no corpus text fails, naming the URL and the fix", () => {
    const item: Item = {
      id: "p.S1.cuckoo-pdf",
      lines: ["Log prompts with the PII removed.", "This is the flaw."],
      flawLine: 2,
      sources: [PDF],
    };
    const source = check(file(item)).find((p) => p.rule === "source");
    expect(source).toMatchObject({ id: item.id });
    expect(source?.message).toContain(PDF);
    expect(source?.message).toContain("pnpm generate:corpus");
  });

  it("SC-5: `# uncached: <url> — <reason>` exempts that source", () => {
    const item: Item = {
      id: "p.S1.cuckoo-pdf-exempt",
      lines: ["Log prompts with the PII removed.", "This is the flaw."],
      flawLine: 2,
      sources: [PDF],
      comments: [`# uncached: ${PDF} — corpus.ts does not store PDFs`],
    };
    expect(check(file(item))).toEqual([]);
  });

  it("SC-5: an uncached exemption with no reason, or for a URL the item does not cite, fails", () => {
    const noReason: Item = {
      id: "p.S1.cuckoo-pdf-noreason",
      lines: ["Fine line.", "This is the flaw."],
      flawLine: 2,
      sources: [PDF],
      comments: [`# uncached: ${PDF} —`],
    };
    const stale: Item = {
      id: "p.S1.cuckoo-pdf-stale",
      lines: ["Fine line.", "This is the flaw."],
      flawLine: 2,
      sources: [CONTEXT],
      comments: [`# uncached: ${PDF} — not cited here`],
    };
    expect(check(file(noReason)).map((p) => p.id)).toContain(noReason.id);
    expect(check(file(stale)).map((p) => p.id)).toContain(stale.id);
  });

  it("SC-5: the exemption does not ground a token that only an uncached source could show", () => {
    const item: Item = {
      id: "p.S1.cuckoo-pdf-token",
      lines: ["Set `log_full_prompts` to false.", "This is the flaw."],
      flawLine: 2,
      sources: [PDF],
      comments: [`# uncached: ${PDF} — corpus.ts does not store PDFs`],
    };
    expect(check(file(item))).toContainEqual(
      expect.objectContaining({ rule: "token", word: "log_full_prompts" }),
    );
  });

  it("edge: YAML that does not parse fails, naming the file", () => {
    expect(check("cuckoos: [\n  - id: x\n")).toContainEqual(
      expect.objectContaining({
        file: "packs/p/cuckoos/S1.yaml",
        rule: "parse",
      }),
    );
  });

  it("edge: annotations are per item, not per file", () => {
    const annotated: Item = {
      ...D7S2_PRE_FIX,
      id: "p.S1.cuckoo-a",
      comments: ["# grounded: never — a reason"],
    };
    const bare: Item = { ...D7S2_PRE_FIX, id: "p.S1.cuckoo-b" };
    const ids = check(file(annotated, bare))
      .filter((p) => p.rule === "quantifier")
      .map((p) => p.id);
    expect(ids).toEqual(["p.S1.cuckoo-b"]);
  });
});
