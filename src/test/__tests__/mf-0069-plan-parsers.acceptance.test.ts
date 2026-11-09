/**
 * MF-0069 acceptance (frozen): `pnpm gate:planning` refuses a governed plan (ticket after MF-0068, not reserved, stage
 * build or later) whose task `owns` include a non-test glob under scripts/, .claude/hooks/ or src/engine/ unless its
 * `## Parsers` section says `None: <reason>` or holds complete `### <name>` blocks. Expected values come from GOAL.md
 * SC-1…SC-6. Proof case: the MF-0048 LOOP-PLAN (no Parsers section; owns .claude/hooks/lib/agent-scopes.mjs).
 */
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkPlanParsers } from "../../../scripts/lib/planning-check.mjs";

const ROOT = resolve(__dirname, "../../..");
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const goal = (
  id: string,
  { stage = "build", status = "in-progress" } = {},
): string =>
  `---\nticket_id: ${id}\ntitle: "x"\ntier: high-risk\nstage: ${stage}\nlast_iteration: 0\ngoal_status: ${status}\n---\n\n## Objective\n\nX.\n`;

const tasksBlock = (owns: string[]): string =>
  `\`\`\`json tasks\n${JSON.stringify([{ id: "T1", agent: "inline", owns, depends_on: [], closes: ["SC-1"], done_when: "x", context: "x" }], null, 2)}\n\`\`\`\n`;

const plan = (parsers: string | null, owns = ["scripts/lib/x.mjs"]): string =>
  `# MF-9999 LOOP-PLAN\n\n## Discovery\n\nX.\n\n${parsers === null ? "" : `## Parsers\n\n${parsers}\n\n`}## Steps\n\n1. x\n\n${tasksBlock(owns)}`;

const entry = (planText: string | null, id = "MF-9999", opts = {}) => ({
  dir: id,
  goalText: goal(id, opts),
  planText,
});

const GOOD_BLOCK = [
  "### Header line",
  "",
  "Accepted grammar: `key: value` with a lower-case key; anything else is an error naming the line.",
  "",
  "Rejected inputs:",
  "",
  "| Input | Expected error |",
  "|---|---|",
  "| `Key: v` | upper-case key |",
  "| `key v` | missing colon |",
  "| empty line | blank header |",
  "",
  "Exempt-path test: none: no item is exempt.",
].join("\n");

const NO_SECTION =
  'MF-9999: LOOP-PLAN owns .claude/hooks/lib/agent-scopes.mjs but has no "## Parsers" section (write "None: <reason>" or one ### block per parser)';

describe("MF-0069 plan parsers", () => {
  it("SC-1: the MF-0048 plan (no Parsers section) fails under a governed ticket", () => {
    const mf0048 = readFileSync(
      join(ROOT, ".planning/tasks/MF-0048/LOOP-PLAN.md"),
      "utf8",
    );
    expect(mf0048).not.toMatch(/^## Parsers/m);
    expect(checkPlanParsers([entry(mf0048)])).toEqual([NO_SECTION]);
  });

  it("SC-2: None: <reason> passes; a bare None: or an empty section fails", () => {
    expect(
      checkPlanParsers([entry(plan("None: only moves a constant."))]),
    ).toEqual([]);
    const bare = checkPlanParsers([entry(plan("None:"))]);
    expect(bare).toHaveLength(1);
    expect(bare[0]).toMatch(/^MF-9999: /);
    const empty = checkPlanParsers([entry(plan("Some prose, no blocks."))]);
    expect(empty).toHaveLength(1);
    expect(empty[0]).toMatch(/^MF-9999: /);
  });

  it("SC-3: each ### block needs its grammar, a 3-row rejected table and an exempt-path test", () => {
    expect(checkPlanParsers([entry(plan(GOOD_BLOCK))])).toEqual([]);

    const noGrammar = GOOD_BLOCK.replace(/^Accepted grammar:.*$/m, "");
    expect(checkPlanParsers([entry(plan(noGrammar))])).toEqual([
      'MF-9999: Parsers block "Header line" has no "Accepted grammar:" line',
    ]);

    const twoRows = GOOD_BLOCK.replace("| empty line | blank header |\n", "");
    expect(checkPlanParsers([entry(plan(twoRows))])).toEqual([
      'MF-9999: Parsers block "Header line" has no Rejected inputs table with 3 or more rows',
    ]);

    const noExempt = GOOD_BLOCK.replace(/^Exempt-path test:.*$/m, "");
    expect(checkPlanParsers([entry(plan(noExempt))])).toEqual([
      'MF-9999: Parsers block "Header line" has no "Exempt-path test:" line',
    ]);

    const second = `${GOOD_BLOCK}\n\n### Owns list\n\nAccepted grammar: repo-relative globs.\n`;
    expect(checkPlanParsers([entry(plan(second))])).toEqual([
      'MF-9999: Parsers block "Owns list" has no Rejected inputs table with 3 or more rows',
      'MF-9999: Parsers block "Owns list" has no "Exempt-path test:" line',
    ]);
  });

  it("SC-4: out of scope tickets and plans are not judged; CRLF reads like LF", () => {
    const missing = plan(null);
    expect(
      checkPlanParsers([
        entry(missing, "MF-0068"),
        entry(missing, "MF-0048"),
        entry(missing, "MF-9999", { status: "reserved" }),
        entry(missing, "MF-9998", { stage: "intake" }),
        entry(missing, "MF-9997", { stage: "design" }),
        entry(missing, "MF-9996", { stage: "plan" }),
        entry(null, "MF-9995"),
        entry("# no tasks block\n", "MF-9994"),
        entry(plan(null, ["scripts/lib/__tests__/x.test.ts"]), "MF-9993"),
        entry(plan(null, ["src/features/x/**", "docs/x.md"]), "MF-9992"),
      ]),
    ).toEqual([]);

    for (const stage of ["build", "test", "handoff", "watch"])
      expect(
        checkPlanParsers([entry(missing, "MF-9999", { stage })]),
      ).toHaveLength(1);

    const crlf = plan(GOOD_BLOCK).replace(/\n/g, "\r\n");
    expect(checkPlanParsers([entry(crlf)])).toEqual([]);
  });

  it("SC-5: gate:planning exits 1 on the proof case in a fixture tasks dir", () => {
    const dir = mkdtempSync(join(tmpdir(), "mf0069-"));
    roots.push(dir);
    mkdirSync(join(dir, "MF-9999"));
    writeFileSync(join(dir, "MF-9999", "GOAL.md"), goal("MF-9999"));
    writeFileSync(
      join(dir, "MF-9999", "LOOP-PLAN.md"),
      readFileSync(join(ROOT, ".planning/tasks/MF-0048/LOOP-PLAN.md"), "utf8"),
    );
    const r = spawnSync(
      process.execPath,
      [join(ROOT, "scripts/check-planning.mjs")],
      {
        cwd: ROOT,
        env: {
          ...process.env,
          MF_TASKS_DIR: dir,
          MF_EVIDENCE_DIR: join(dir, "evidence"),
          MF_REPO_DIR: dir,
        },
        encoding: "utf8",
      },
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toContain(NO_SECTION);
  });

  it("SC-6: the template's Parsers example passes the rule", () => {
    const template = readFileSync(
      join(ROOT, ".claude/skills/gsd-goal-loop/references/templates.md"),
      "utf8",
    ).replace(/\r\n/g, "\n");
    const m =
      /<!-- parsers-example -->\n([\s\S]*?)\n<!-- \/parsers-example -->/.exec(
        template,
      );
    expect(m, "parsers-example markers in templates.md").not.toBeNull();
    const example = m?.[1] ?? "";
    expect(example).toMatch(/^None: /m);
    expect(example).toMatch(/^### /m);
    const blocks = example.replace(/^None: .*$/m, "");
    expect(checkPlanParsers([entry(plan(blocks))])).toEqual([]);
  });
});
