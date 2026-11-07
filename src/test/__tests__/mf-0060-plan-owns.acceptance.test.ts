/**
 * MF-0060 acceptance (frozen): `pnpm gate:planning` judges LOOP-PLAN `owns` against each role agent's SCOPES
 * (rule 1, with MF-0048's per-task check wired in) and, at hand-off, every changed file against the union of `owns`
 * (rule 2). Expected values come from GOAL.md SC-1…SC-7, not from the checker. Proof case: MF-0058 at cc79c34.
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
import {
  checkChangedFilesOwned,
  checkPlanOwns,
  planOwnsProblems,
  unownedChangedFiles,
} from "../../../scripts/lib/planning-check.mjs";
import { parsePlanTasks } from "../../../scripts/lib/ticket-eval.mjs";

const ROOT = resolve(__dirname, "../../..");

const SB_SCOPE =
  "src/engine/**, src/server/**, packs/**, src/lib/**, src/features/*/actions.ts, src/features/*/actions/**, .planning/tasks/*/LOOP-PLAN.md";
const scopeLine = (
  dir: string,
  task: string,
  agent: string,
  glob: string,
  witness: string,
  scope: string,
) =>
  `${dir}: ${task}: ${agent} may not own ${glob}: ${witness} is outside its scope (${scope}). Give it to a task whose agent's scope holds it, or to an "orchestrator" task (SCOPES in .claude/hooks/lib/agent-scopes.mjs)`;
const r2Line = (dir: string, file: string) =>
  `${dir}: ${file} is changed but in no task's owns. Add it to the owns of the task that wrote it in .planning/tasks/${dir}/LOOP-PLAN.md (an "orchestrator" task for a file no role agent may write)`;

interface GoalParts {
  id?: string;
  stage?: string;
  status?: string;
}
const goal = ({
  id = "MF-0061",
  stage = "build",
  status = "in-progress",
}: GoalParts = {}): string =>
  [
    "---",
    `ticket_id: ${id}`,
    "tier: normal",
    `stage: ${stage}`,
    `goal_status: ${status}`,
    "---",
    "",
    "## Success Criteria",
    "",
    "- [ ] SC-1: works. Proof: a unit test.",
    "",
    "## Iteration Log",
    "",
    "- 2026-11-06 design preflight: nothing named.",
    "",
  ].join("\n");

const task = (id: string, agent: unknown, owns: unknown) => ({
  id,
  agent,
  owns,
  depends_on: [],
  closes: ["SC-1"],
  done_when: [],
});
const plan = (tasks: unknown[]): string =>
  `# Loop Plan\n\n\`\`\`json tasks\n${JSON.stringify(tasks, null, 2)}\n\`\`\`\n`;

const rule1 = (tasks: unknown[], parts: GoalParts = {}) =>
  checkPlanOwns([
    {
      dir: parts.id ?? "MF-0061",
      goalText: goal(parts),
      planText: plan(tasks),
    },
  ]);

describe("MF-0060 rule 1: owns inside the agent's SCOPES", () => {
  it("SC-1: an exact path outside service-builder's scope is one line naming task, agent, glob and scope", () => {
    expect(
      rule1([task("T4", "service-builder", ["src/features/paths/schemas.ts"])]),
    ).toEqual([
      scopeLine(
        "MF-0061",
        "T4",
        "service-builder",
        "src/features/paths/schemas.ts",
        "src/features/paths/schemas.ts",
        SB_SCOPE,
      ),
    ]);
  });

  it("SC-1: a glob that reaches outside names the shortest witness path", () => {
    expect(rule1([task("T1", "service-builder", ["src/features/**"])])).toEqual(
      [
        scopeLine(
          "MF-0061",
          "T1",
          "service-builder",
          "src/features/**",
          "src/features/x",
          SB_SCOPE,
        ),
      ],
    );
  });

  it("SC-1: a brace set is checked per alternative", () => {
    expect(
      rule1([
        task("T4", "service-builder", [
          "src/features/paths/{schemas,types}.ts",
        ]),
      ]),
    ).toEqual([
      scopeLine(
        "MF-0061",
        "T4",
        "service-builder",
        "src/features/paths/schemas.ts",
        "src/features/paths/schemas.ts",
        SB_SCOPE,
      ),
      scopeLine(
        "MF-0061",
        "T4",
        "service-builder",
        "src/features/paths/types.ts",
        "src/features/paths/types.ts",
        SB_SCOPE,
      ),
    ]);
  });

  it("SC-1: globs inside the scope pass", () => {
    expect(
      rule1([
        task("T1", "service-builder", [
          "src/engine/path/**",
          "src/features/storm/actions.ts",
          "src/features/*/actions/**",
        ]),
        task("T2", "ui-builder", ["src/app/(app)/paths/[pathSlug]/page.tsx"]),
        task("T3", "acceptance-writer", ["src/features/x/__tests__/a.test.ts"]),
      ]),
    ).toEqual([]);
  });
});

describe("MF-0060 rule 1: MF-0048's per-task check is wired in", () => {
  it("SC-2: a NEVER path gives the NEVER line only, and a non-plan agent is unknown", () => {
    expect(
      rule1([
        task("T1", "service-builder", ["scripts/x.mjs"]),
        task("T2", "verifier", [".planning/tasks/MF-0061/LOOP-VERIFY.md"]),
      ]),
    ).toEqual([
      "MF-0061: T1: service-builder may not own scripts/x.mjs: it can match NEVER glob scripts/** (role agents never write it; agent-scopes.mjs)",
      'MF-0061: T2: unknown agent "verifier"',
    ]);
  });

  it("SC-2: orchestrator and inline tasks may own scripts, hooks and package files", () => {
    expect(
      rule1([
        task("T1", "orchestrator", ["scripts/**", "package.json"]),
        task("T2", "inline", [
          ".claude/hooks/lib/x.mjs",
          ".planning/evidence/MF-0061.md",
        ]),
      ]),
    ).toEqual([]);
  });
});

describe("MF-0060 rule 1: which tickets it judges", () => {
  const bad = [task("T4", "service-builder", ["src/features/paths/types.ts"])];

  it("SC-3: at stage plan a missing plan is fine; from build on it is a line", () => {
    expect(
      checkPlanOwns([
        { dir: "MF-0061", goalText: goal({ stage: "plan" }), planText: null },
        {
          dir: "MF-0062",
          goalText: goal({ id: "MF-0062", stage: "plan" }),
          planText: "# draft, no block yet\n",
        },
      ]),
    ).toEqual([]);
    expect(
      checkPlanOwns([
        { dir: "MF-0061", goalText: goal({ stage: "build" }), planText: null },
        {
          dir: "MF-0062",
          goalText: goal({ id: "MF-0062", stage: "test" }),
          planText: "# no block\n",
        },
      ]),
    ).toEqual([
      "MF-0061: stage build but no LOOP-PLAN.md",
      "MF-0062: stage test but LOOP-PLAN.md has no ```json tasks block",
    ]);
  });

  it("SC-3: stage plan with a bad graph is already judged", () => {
    expect(rule1(bad, { stage: "plan" })).toHaveLength(1);
  });

  it("SC-3: MF-0060 and older, stage design and reserved tickets are not judged", () => {
    expect(rule1(bad, { id: "MF-0060" })).toEqual([]);
    expect(rule1(bad, { id: "MF-0058" })).toEqual([]);
    expect(rule1(bad, { stage: "design" })).toEqual([]);
    expect(rule1(bad, { status: "reserved", stage: "build" })).toEqual([]);
  });
});

describe("MF-0060 rule 2: every changed file is owned", () => {
  const handoff = goal({
    stage: "handoff",
    status: "complete-pending-manual-commit",
  });
  const tasks = [
    task("T1", "service-builder", ["src/engine/x/**"]),
    task("T2", "orchestrator", [".claude/rules/{testing,ui-design}.md"]),
  ];
  const frozen = JSON.stringify({
    files: [{ path: "src/server/__tests__/mf-0061-x.db.acceptance.test.ts" }],
  });
  const retro = [
    "## Actions",
    "- skill-edit: `.claude/agents/ticket-planner.md` (proposed, see Applied)",
    "",
    "## Applied",
    "",
    "- 2026-11-06 action 1: applied. `.claude/skills/gsd-goal-loop/references/templates.md` (LOOP-PLAN shape).",
    "",
  ].join("\n");
  const entry = {
    dir: "MF-0061",
    goalText: handoff,
    planText: plan(tasks),
    frozenText: frozen,
    retroText: retro,
  };
  const changed = [
    ".planning/tasks/MF-0061/GOAL.md",
    ".planning/evidence/MF-0061.md",
    "package.json",
    "src/engine/x/a.ts",
    ".claude/rules/testing.md",
    "src/server/__tests__/mf-0061-x.db.acceptance.test.ts",
    ".claude/skills/gsd-goal-loop/references/templates.md",
    ".claude/agents/ticket-planner.md",
    "pnpm-lock.yaml",
    "src/features/y/types.ts",
  ];

  it("SC-4: one line per unowned file; planning state, package.json, frozen and retro-applied files are exempt", () => {
    expect(checkChangedFilesOwned([entry], changed)).toEqual([
      r2Line("MF-0061", ".claude/agents/ticket-planner.md"),
      r2Line("MF-0061", "pnpm-lock.yaml"),
      r2Line("MF-0061", "src/features/y/types.ts"),
    ]);
  });

  it("SC-4: a file is owned by any ticket folder in the changed set", () => {
    const other = {
      dir: "MF-0062",
      goalText: goal({ id: "MF-0062", stage: "build" }),
      planText: plan([task("T1", "ui-builder", ["src/features/y/**"])]),
      frozenText: null,
      retroText: null,
    };
    expect(
      checkChangedFilesOwned(
        [entry, other],
        [...changed, ".planning/tasks/MF-0062/LOOP-PLAN.md"],
      ),
    ).toEqual([
      r2Line("MF-0061", ".claude/agents/ticket-planner.md"),
      r2Line("MF-0061", "pnpm-lock.yaml"),
    ]);
  });

  it("SC-4: not judged when the folder is not in the set, the ticket is in progress, older, or git was skipped", () => {
    const off = changed.filter((f) => !f.startsWith(".planning/tasks/"));
    expect(checkChangedFilesOwned([entry], off)).toEqual([]);
    expect(
      checkChangedFilesOwned(
        [{ ...entry, goalText: goal({ stage: "test" }) }],
        changed,
      ),
    ).toEqual([]);
    expect(
      checkChangedFilesOwned(
        [
          {
            ...entry,
            dir: "MF-0060",
            goalText: goal({
              id: "MF-0060",
              stage: "handoff",
              status: "complete-pending-manual-commit",
            }),
          },
        ],
        changed.map((f) => f.replace("MF-0061", "MF-0060")),
      ),
    ).toEqual([]);
    expect(checkChangedFilesOwned([entry], null)).toEqual([]);
  });
});

describe("MF-0060 scripts/check-planning.mjs runs rule 2 with git", () => {
  const fixture = mkdtempSync(join(tmpdir(), "mf-0060-"));
  afterAll(() => rmSync(fixture, { recursive: true, force: true }));

  const git = (repo: string, ...args: string[]) =>
    spawnSync("git", args, {
      cwd: repo,
      encoding: "utf8",
      env: {
        ...process.env,
        GIT_AUTHOR_NAME: "fixture",
        GIT_AUTHOR_EMAIL: "fixture@example.invalid",
        GIT_COMMITTER_NAME: "fixture",
        GIT_COMMITTER_EMAIL: "fixture@example.invalid",
      },
    });

  /** A repo whose `branch` points at one root commit of a README, with a hand-off ticket MF-0061 untracked on top. */
  const makeRepo = (name: string, branch: string, owns: string[]) => {
    const repo = join(fixture, name);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", branch);
    writeFileSync(join(repo, "README.md"), "fixture\n");
    const blob = git(repo, "hash-object", "-w", "README.md").stdout.trim();
    const tree = spawnSync("git", ["mktree"], {
      cwd: repo,
      encoding: "utf8",
      input: `100644 blob ${blob}\tREADME.md\n`,
    }).stdout.trim();
    const commit = git(repo, "commit-tree", tree, "-m", "root").stdout.trim();
    git(repo, "update-ref", `refs/heads/${branch}`, commit);
    git(repo, "reset", "-q");
    const dir = join(repo, ".planning", "tasks", "MF-0061");
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, "GOAL.md"),
      goal({ stage: "handoff", status: "complete-pending-manual-commit" }),
    );
    writeFileSync(
      join(dir, "LOOP-PLAN.md"),
      plan([task("T1", "orchestrator", owns)]),
    );
    const evidence = join(repo, ".planning", "evidence");
    mkdirSync(evidence, { recursive: true });
    writeFileSync(
      join(evidence, "MF-0061.md"),
      "# MF-0061\n\n## See it yourself\n\nn/a: fixture.\n",
    );
    mkdirSync(join(repo, "src"), { recursive: true });
    writeFileSync(join(repo, "src", "x.ts"), "export {};\n");
    return repo;
  };

  const runCli = (repo: string) =>
    spawnSync(process.execPath, [join(ROOT, "scripts/check-planning.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      env: {
        ...process.env,
        MF_REPO_DIR: repo,
        MF_TASKS_DIR: join(repo, ".planning", "tasks"),
        MF_EVIDENCE_DIR: join(repo, ".planning", "evidence"),
      },
    });

  it("SC-5: without a main ref rule 2 is skipped with one line, exit 0, nothing on stderr", () => {
    const run = runCli(makeRepo("no-main", "trunk", ["docs/**"]));
    expect(run.stdout).toContain("gate:planning: rule 2 skipped: no main ref");
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });

  it("SC-5: with main, an untracked file in no task's owns fails the gate", () => {
    const run = runCli(makeRepo("unowned", "main", ["docs/**"]));
    expect(run.stdout).toContain(r2Line("MF-0061", "src/x.ts"));
    expect(run.stdout).not.toContain("rule 2 skipped");
    expect(run.stderr).toBe("");
    expect(run.status).toBe(1);
  });

  it("SC-5: with main, the same file owned by an orchestrator task passes", () => {
    const run = runCli(makeRepo("owned", "main", ["src/x.ts"]));
    expect(run.stdout).not.toContain("rule 2 skipped");
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });
});

describe("MF-0060 proof case: MF-0058 as merged (cc79c34)", () => {
  const show = (path: string): string => {
    const run = spawnSync("git", ["show", `cc79c34:${path}`], {
      cwd: ROOT,
      encoding: "utf8",
    });
    return run.stdout;
  };
  const { tasks } = parsePlanTasks(
    show(".planning/tasks/MF-0058/LOOP-PLAN.md"),
  );

  it("SC-6: rule 1 flags T4's schemas.ts and types.ts among 11 lines", () => {
    const problems = planOwnsProblems(tasks);
    expect(problems).toHaveLength(11);
    for (const file of ["schemas", "types"])
      expect(problems).toContain(
        `T4: service-builder may not own src/features/paths/${file}.ts: src/features/paths/${file}.ts is outside its scope (${SB_SCOPE}). Give it to a task whose agent's scope holds it, or to an "orchestrator" task (SCOPES in .claude/hooks/lib/agent-scopes.mjs)`,
      );
  });

  it("SC-6: rule 2 over the merge diff is exactly the three files the review found", () => {
    const changed = spawnSync(
      "git",
      ["diff", "--name-only", "--no-renames", "be7575d", "cc79c34"],
      { cwd: ROOT, encoding: "utf8" },
    )
      .stdout.trim()
      .split("\n");
    expect(changed).toHaveLength(114);
    expect(
      unownedChangedFiles(changed, [
        {
          tasks,
          frozenText: show(".planning/tasks/MF-0058/FROZEN.json"),
          retroText: show(".planning/tasks/MF-0058/RETRO.md"),
        },
      ]),
    ).toEqual([
      ".claude/rules/code-conventions.md",
      "src/features/paths/utils/__tests__/path-display.test.ts",
      "src/features/paths/utils/path-display.ts",
    ]);
  });
});

describe("MF-0060 templates.md states the rule", () => {
  it("SC-7: the LOOP-PLAN shape names the gate, the orchestrator convention and both exemptions", () => {
    const text = readFileSync(
      join(ROOT, ".claude/skills/gsd-goal-loop/references/templates.md"),
      "utf8",
    );
    expect(text).toContain("`checkPlanOwns`");
    expect(text).toContain("`checkChangedFilesOwned`");
    expect(text).toContain('`"agent": "orchestrator"`');
    expect(text).toMatch(
      /FROZEN\.json[^\n]*`## Applied`|`## Applied`[^\n]*FROZEN\.json/,
    );
  });
});
