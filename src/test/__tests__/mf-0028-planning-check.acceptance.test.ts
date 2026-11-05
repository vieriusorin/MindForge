/**
 * MF-0028 acceptance (frozen): `pnpm gate:planning`. Every GOAL.md under `.planning/tasks/<dir>/`
 * names exactly one ticket, and it is `<dir>`. Expected values come from GOAL.md SC-1…SC-5 and the
 * edge-input table, not from the checker. Re-frozen 2026-11-05 for C-3 (see FROZEN.json history).
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
import { checkPlanning } from "../../../scripts/lib/planning-check.mjs";

const ROOT = resolve(__dirname, "../../..");

const goal = (id: string, extra = ""): string =>
  `---\nticket_id: ${id}\ntier: normal                      # note\nstage: design\n---\n\n## Objective\n\nText.\n${extra}`;

// Synthetic: a second ticket's whole file appended to the first.
const concatenated = `${goal("MF-0042")}\n${goal("MF-0042")}`;

// Re-frozen 2026-11-05 (C-3): the real seam of .planning/tasks/MF-0022/GOAL.md at merge 71ac090,
// lines 1-8 and 24-35, copied verbatim. The merge kept ONE `ticket_id:` line and dropped the second
// ticket's `---` opener, so only its other keys show the collision.
const merged71ac090 = [
  "---",
  "ticket_id: MF-0022",
  "tier: normal",
  "stage: intake",
  "builds_on: [MF-0009, MF-0010, MF-0012]",
  "last_iteration: 0",
  "goal_status: reserved",
  "---",
  "",
  "> Drafted 2026-11-04 by MF-0012 (user decision C-1). Not started.",
  "",
  "## Objective",
  "",
  "- Seed Planting is Coder D's (KICKOFF): coordinate ownership before touching it.",
  "tier: normal                      # paid model runs + content PRs; no app code",
  "stage: intake",
  "branch: main",
  "builds_on: [MF-0008]",
  "last_iteration: 0",
  "goal_status: reserved             # owner: user (needs an Anthropic API key and the Owner's review)",
  "track: C",
  "week: W2",
  "depends_on: [MF-0008]",
  "---",
  "",
  "## Objective",
  "",
].join("\n");

describe("MF-0028 checkPlanning", () => {
  it("SC-1: one ticket_id but tier/stage/goal_status repeated (the real 71ac090 seam) is a problem", () => {
    const problems = checkPlanning([
      { dir: "MF-0022", goalText: merged71ac090 },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^MF-0022: /);
    for (const key of ["tier", "stage", "goal_status"])
      expect(problems[0]).toContain(key);
  });

  it("SC-1: the same seam with CRLF line endings is the same problem", () => {
    expect(
      checkPlanning([
        { dir: "MF-0022", goalText: merged71ac090.replace(/\n/g, "\r\n") },
      ]),
    ).toEqual(checkPlanning([{ dir: "MF-0022", goalText: merged71ac090 }]));
  });

  it("SC-1: a GOAL.md with two ticket_id lines is a problem naming the folder", () => {
    const problems = checkPlanning([
      { dir: "MF-0042", goalText: concatenated },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^MF-0042: /);
    expect(problems[0]).toMatch(/2 ticket_id lines/);
  });

  it("SC-1: two different ids concatenated are a problem too", () => {
    const problems = checkPlanning([
      { dir: "MF-0042", goalText: `${goal("MF-0042")}\n${goal("MF-0043")}` },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^MF-0042: .*2 ticket_id lines/);
  });

  it("SC-1: a GOAL.md with no ticket_id line is a problem naming the folder", () => {
    const problems = checkPlanning([
      { dir: "MF-0042", goalText: "---\nstage: design\n---\n" },
    ]);
    expect(problems).toEqual(["MF-0042: no ticket_id line"]);
  });

  it("SC-2: a ticket_id that is not the folder name is a problem naming both", () => {
    const problems = checkPlanning([
      { dir: "MF-0042", goalText: goal("MF-0043") },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^MF-0042: /);
    expect(problems[0]).toContain("MF-0043");
  });

  it("SC-3: valid, quoted, commented, CRLF, indented, mid-line and missing-GOAL folders pass", () => {
    const problems = checkPlanning([
      { dir: "MF-0001", goalText: goal("MF-0001") },
      { dir: "MF-0002", goalText: goal('"MF-0002"') },
      { dir: "MF-0003", goalText: goal("'MF-0003'") },
      { dir: "MF-0004", goalText: goal("MF-0004   # reserved by a retro") },
      { dir: "MF-0005", goalText: goal("MF-0005").replace(/\n/g, "\r\n") },
      {
        dir: "MF-0006",
        goalText: goal(
          "MF-0006",
          "\n  ticket_id: MF-9999\nThe key ticket_id: MF-9998 is read.\n",
        ),
      },
      { dir: "MF-0007", goalText: null },
    ]);
    expect(problems).toEqual([]);
  });

  it("SC-3: a column-0 ticket_id inside a fenced block counts (C-2)", () => {
    const problems = checkPlanning([
      {
        dir: "MF-0042",
        goalText: goal("MF-0042", "\n```\nticket_id: MF-0042\n```\n"),
      },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(/^MF-0042: .*2 ticket_id lines/);
  });

  it("SC-3: CRLF text gives the same problem as LF", () => {
    const crlf = concatenated.replace(/\n/g, "\r\n");
    expect(checkPlanning([{ dir: "MF-0042", goalText: crlf }])).toEqual(
      checkPlanning([{ dir: "MF-0042", goalText: concatenated }]),
    );
  });

  it("SC-1/SC-2: one problem per bad folder, good folders add none", () => {
    const problems = checkPlanning([
      { dir: "MF-0001", goalText: goal("MF-0001") },
      { dir: "MF-0002", goalText: concatenated },
      { dir: "MF-0003", goalText: goal("MF-0004") },
    ]);
    expect(problems).toHaveLength(2);
    expect(problems[0]).toMatch(/^MF-0002: /);
    expect(problems[1]).toMatch(/^MF-0003: /);
  });
});

describe("MF-0028 scripts/check-planning.mjs", () => {
  const fixture = mkdtempSync(join(tmpdir(), "mf-0028-"));
  afterAll(() => rmSync(fixture, { recursive: true, force: true }));

  const runCli = (tasksDir?: string) =>
    spawnSync(process.execPath, [join(ROOT, "scripts/check-planning.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, MF_TASKS_DIR: tasksDir ?? "" },
    });

  it("SC-4: exits 1 and prints each bad folder on a fixture tree", () => {
    const tasks = join(fixture, "tasks");
    for (const [dir, text] of [
      ["MF-0001", goal("MF-0001")],
      ["MF-0002", concatenated],
      ["MF-0003", goal("MF-0009")],
    ] as const) {
      mkdirSync(join(tasks, dir), { recursive: true });
      writeFileSync(join(tasks, dir, "GOAL.md"), text);
    }
    mkdirSync(join(tasks, "MF-0004"));
    writeFileSync(join(tasks, "notes.md"), "not a ticket folder\n");

    const run = runCli(tasks);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain("MF-0002: ");
    expect(run.stdout).toContain("MF-0003: ");
    expect(run.stdout).not.toContain("MF-0001: ");
    expect(run.stdout).not.toContain("MF-0004: ");
  });

  it("SC-4: exits 0 when the tasks folder does not exist", () => {
    expect(runCli(join(fixture, "absent")).status).toBe(0);
  });

  it("SC-4: exits 0 on this repo's .planning/tasks", () => {
    const run = runCli();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("SC-5: package.json runs it as gate:planning, so the Stop gate's GATES step picks it up", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.scripts["gate:planning"]).toBe(
      "node scripts/check-planning.mjs",
    );
  });
});
