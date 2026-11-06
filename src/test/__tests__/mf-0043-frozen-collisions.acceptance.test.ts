/**
 * MF-0043 acceptance (frozen): `pnpm ticket:collisions <ID>` flags every frozen acceptance file that a
 * ticket's `## Symbols changed` list reaches and that its "Frozen files this will re-freeze" section has
 * not listed. Expected values come from GOAL.md SC-1…SC-6, not from the checker.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkCollisions } from "../../../scripts/lib/frozen-collisions.mjs";

const ROOT = resolve(__dirname, "../../..");
const CLI = join(ROOT, "scripts/frozen-collisions.mjs");

// The tree before MF-0032 changed the call: `toPlayableQuestion(q)` at :70, its import at :10.
const PRE_MF_0032 = "862f462~1";
const P3 =
  "src/engine/questions/__tests__/mf-0003-questions.acceptance.test.ts";
const P8 = "src/engine/questions/__tests__/mf-0008-schema.acceptance.test.ts";
const P12 =
  "src/features/duel/components/duel-session/__tests__/mf-0012-duel.acceptance.test.tsx";

const gitShow = (path: string): string =>
  execFileSync("git", ["show", `${PRE_MF_0032}:${path}`], {
    cwd: ROOT,
    encoding: "utf8",
  });

const temps: string[] = [];
afterAll(() => {
  for (const dir of temps) rmSync(dir, { recursive: true, force: true });
});

const write = (root: string, path: string, text: string): void => {
  mkdirSync(dirname(join(root, path)), { recursive: true });
  writeFileSync(join(root, path), text);
};

const refreezeTable = (paths: string[]): string =>
  [
    "### Frozen files this will re-freeze (one batch, at plan approval)",
    "",
    "| File | Change | Reason |",
    "|---|---|---|",
    ...paths.map((p) => `| \`${p}\` | change | reason |`),
    "",
  ].join("\n");

const goal = (extra = ""): string =>
  `---\nticket_id: MF-0099\nstage: plan\n---\n\n## Objective\n\nx\n\n${extra}`;

/** A temp repo with the pre-MF-0032 MF-0003 and MF-0008 files and ticket MF-0099. */
function proofRepo(listed: string[]): string {
  const root = mkdtempSync(join(tmpdir(), "mf-0043-"));
  temps.push(root);
  write(root, P3, gitShow(P3));
  write(root, P8, gitShow(P8));
  write(root, ".planning/tasks/MF-0099/GOAL.md", goal());
  write(
    root,
    ".planning/tasks/MF-0099/LOOP-PLAN.md",
    [
      "# MF-0099 plan",
      "",
      "## Symbols changed",
      "",
      "- function `toPlayableQuestion`",
      "",
      refreezeTable(listed),
    ].join("\n"),
  );
  return root;
}

const run = (root: string, ticket: string) =>
  spawnSync("node", [CLI, ticket], {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, MF_ROOT: root },
  });

const escapeRegExp = (s: string): string =>
  s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasHit = (out: string, path: string, line: number): boolean =>
  new RegExp(`^${escapeRegExp(path)}:${line}(?!\\d)`, "m").test(out);

const input = (over: {
  goalText?: string | null;
  planText?: string | null;
  ownFrozen?: string[];
  files: { path: string; text: string }[];
}) => ({
  ticket: "MF-0099",
  goalText: over.goalText === undefined ? goal() : over.goalText,
  planText: over.planText === undefined ? null : over.planText,
  ownFrozen: over.ownFrozen ?? [],
  files: over.files,
});

const SAMPLE = [
  'import { toPlayableQuestion } from "x";',
  "const a = toPlayableQuestion(q);",
  "const b = toPlayableQuestionX(q);",
  "const t: PackContent = x;",
  "const k = 'question';",
  "const ITEM_TYPESX = 1;",
  "import {",
  "  parseQuestionFiles,",
  "  toPlayableQuestion,",
  '} from "..";',
  'import { toPlayableQuestionX } from "y";',
].join("\n");

describe("MF-0043 frozen-collision check", () => {
  it("SC-1: proof case RED: the unlisted MF-0008 call and import are flagged, exit 1", () => {
    const root = proofRepo([P3, P12]);
    const res = run(root, "MF-0099");
    expect(res.status).toBe(1);
    expect(hasHit(res.stdout, P8, 10)).toBe(true);
    expect(hasHit(res.stdout, P8, 70)).toBe(true);
    expect(res.stdout).not.toContain("mf-0003");
  });

  it("SC-2: proof case GREEN: with the MF-0008 row listed, exit 0", () => {
    const root = proofRepo([P3, P12, `${P8}:70`]);
    const res = run(root, "MF-0099");
    expect(res.status).toBe(0);
    expect(res.stdout.trim()).toBe(
      "ticket:collisions: MF-0099: no unlisted collisions (2 frozen files scanned)",
    );
  });

  it("SC-3: function, name and literal kinds; file-level listing inside the re-freeze section only", () => {
    const symbols = [
      "## Symbols changed",
      "",
      "- function `toPlayableQuestion`",
      "- name `PackContent`",
      "- name `ITEM_TYPES`",
      "- literal `'question'`",
      "",
    ].join("\n");
    const plan = [
      symbols,
      "## Frozen files this will re-freeze",
      "",
      "| File | Change |",
      "|---|---|",
      "| `b.acceptance.test.ts:3-4` | fixture |",
      "",
      "## Discovery",
      "",
      "`c.acceptance.test.ts` is mentioned here, outside the section.",
    ].join("\n");
    const files = ["a", "b", "c"].map((n) => ({
      path: `${n}.acceptance.test.ts`,
      text: SAMPLE,
    }));
    const res = checkCollisions(input({ planText: plan, files }));
    const expected = [1, 2, 4, 5, 9];
    expect(res.code).toBe(1);
    expect(res.hits).toEqual([
      ...expected.map((l) => `a.acceptance.test.ts:${l}`),
      ...expected.map((l) => `c.acceptance.test.ts:${l}`),
    ]);

    const prefix = checkCollisions(
      input({
        planText: "## Symbols changed\n\n- function `toPlayable`\n",
        files: [{ path: "d.acceptance.test.ts", text: SAMPLE }],
      }),
    );
    expect(prefix.hits).toEqual([]);
    expect(prefix.code).toBe(0);
  });

  it("SC-4: the ticket's own frozen files are never flagged", () => {
    const res = checkCollisions(
      input({
        planText: "## Symbols changed\n\n- function `toPlayableQuestion`\n",
        ownFrozen: ["src/y/other.acceptance.test.ts"],
        files: [
          { path: "src/x/mf-0099-own.acceptance.test.ts", text: SAMPLE },
          { path: "src/y/other.acceptance.test.ts", text: SAMPLE },
        ],
      }),
    );
    expect(res.hits).toEqual([]);
    expect(res.code).toBe(0);
  });

  it("SC-5: fail loud on a missing section, a bad bullet or an unknown ID; `- none` passes", () => {
    const files = [{ path: "a.acceptance.test.ts", text: SAMPLE }];

    const missing = checkCollisions(
      input({ goalText: goal(), planText: null, files }),
    );
    expect(missing.code).toBe(2);
    expect(missing.message).toContain("Symbols changed");

    const bad = checkCollisions(
      input({ planText: "## Symbols changed\n\n- method `foo`\n", files }),
    );
    expect(bad.code).toBe(2);
    expect(bad.message).toContain("- method `foo`");

    const none = checkCollisions(
      input({ planText: "## Symbols changed\n\n- none\n", files }),
    );
    expect(none.code).toBe(0);
    expect(none.hits).toEqual([]);

    const root = proofRepo([P3]);
    const unknown = run(root, "MF-0098");
    expect(unknown.status).toBe(2);
    expect(`${unknown.stdout}${unknown.stderr}`).toContain("MF-0098");
  });

  it("SC-6: symbols and listing are read from GOAL.md and LOOP-PLAN.md together", () => {
    const files = ["a", "b"].map((n) => ({
      path: `${n}.acceptance.test.ts`,
      text: SAMPLE,
    }));
    const symbolsInGoal = checkCollisions(
      input({
        goalText: goal("## Symbols changed\n\n- name `PackContent`\n"),
        planText: refreezeTable(["b.acceptance.test.ts"]),
        files,
      }),
    );
    expect(symbolsInGoal.hits).toEqual(["a.acceptance.test.ts:4"]);
    expect(symbolsInGoal.code).toBe(1);

    const listedInGoal = checkCollisions(
      input({
        goalText: goal(refreezeTable(["a.acceptance.test.ts"])),
        planText: "## Symbols changed\n\n- name `PackContent`\n",
        files,
      }),
    );
    expect(listedInGoal.hits).toEqual(["b.acceptance.test.ts:4"]);

    const designOnly = checkCollisions(
      input({
        goalText: goal("## Symbols changed\n\n- name `PackContent`\n"),
        planText: null,
        files,
      }),
    );
    expect(designOnly.hits).toEqual([
      "a.acceptance.test.ts:4",
      "b.acceptance.test.ts:4",
    ]);
  });
});
