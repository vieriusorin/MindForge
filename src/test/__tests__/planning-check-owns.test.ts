/**
 * MF-0060 inner tests for the plan-owns rules: the exact glob-inclusion search against a brute-force oracle (the scope
 * hook's own regexes over every short path), plus the parser edges in GOAL.md's edge table.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { globToRegExp } from "../../../.claude/hooks/lib/util.mjs";
import {
  checkChangedFilesOwned,
  globEscapesScope,
  planOwnsProblems,
  unownedChangedFiles,
} from "../../../scripts/lib/planning-check.mjs";

/** Every string up to `max` chars over `alphabet` that is a repo path: non-empty, no leading/trailing/doubled `/`. */
function repoPaths(alphabet: string[], max: number): string[] {
  const out: string[] = [];
  let layer = [""];
  for (let n = 1; n <= max; n++) {
    layer = layer.flatMap((p) => alphabet.map((c) => p + c));
    for (const p of layer)
      if (!p.startsWith("/") && !p.endsWith("/") && !p.includes("//"))
        out.push(p);
  }
  return out;
}

describe("globEscapesScope", () => {
  const paths = repoPaths(["a", "b", "/", "x"], 6);
  const globs = [
    "a",
    "a/b",
    "a/*",
    "a/**",
    "**/b",
    "**/b/**",
    "a/*/b",
    "a/**/b",
    "*",
    "**",
    "a?",
    "?/**",
    "a*b",
    "b/a*",
  ];
  const scopes = [
    ["a/**"],
    ["**/b"],
    ["a/*", "b/**"],
    ["a/*/b", "a/b/**"],
    ["**/b/**", "a"],
    ["*", "*/*"],
    [],
  ];

  it("agrees with a brute-force check over every path up to 6 chars", () => {
    for (const glob of globs)
      for (const scope of scopes) {
        const g = globToRegExp(glob);
        const s = scope.map(globToRegExp);
        const brute = paths.find(
          (p) => g.test(p) && !s.some((re) => re.test(p)),
        );
        const witness = globEscapesScope(glob, scope);
        expect(
          witness === null,
          `${glob} vs [${scope.join(", ")}]: brute ${brute}`,
        ).toBe(brute === undefined);
        if (witness !== null) {
          expect(g.test(witness)).toBe(true);
          expect(s.some((re) => re.test(witness))).toBe(false);
        }
      }
  });

  it("returns a repo-shaped witness, never a bare directory", () => {
    expect(globEscapesScope("paths/**", ["src/**"])).toBe("paths/x");
    expect(globEscapesScope("src/**", ["src/**"])).toBeNull();
  });

  it("renders the other-char as one the globs do not name", () => {
    expect(globEscapesScope("src/*", ["src/x"])).toBe("src/y");
  });
});

describe("planOwnsProblems edges", () => {
  it("an orchestrator task with an unreadable glob still gets the syntax line", () => {
    const problems = planOwnsProblems([
      { id: "T1", agent: "orchestrator", owns: ["scripts/a b.mjs"] },
    ]);
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^T1: owns "scripts\/a b\.mjs" has an unreadable segment/,
    );
  });

  it("a nested brace set is reported once by the syntax rule, with no scope line", () => {
    const problems = planOwnsProblems([
      { id: "T1", agent: "service-builder", owns: ["src/{a,{b,c}}.ts"] },
    ]);
    expect(problems).toEqual(['T1: owns "src/{a,{b,c}}.ts" nests a brace set']);
  });

  it("case variants are outside the scope (the hook is case-sensitive)", () => {
    expect(
      planOwnsProblems([
        { id: "T1", agent: "service-builder", owns: ["Src/engine/x.ts"] },
      ]),
    ).toHaveLength(1);
  });
});

describe("rule 2 record edges", () => {
  const tasks = [{ id: "T1", agent: "orchestrator", owns: ["docs/**"] }];

  it("a RETRO without ## Applied and an unparseable FROZEN.json exempt nothing", () => {
    expect(
      unownedChangedFiles(
        ["src/a.ts", ".claude/x.md"],
        [
          {
            tasks,
            frozenText: "{not json",
            retroText: "## Actions\n- `.claude/x.md`\n",
          },
        ],
      ),
    ).toEqual(["src/a.ts", ".claude/x.md"]);
  });

  it("deleted and renamed paths are judged like any other path", () => {
    expect(
      unownedChangedFiles(["docs/old.md", "src/renamed-from.ts"], [{ tasks }]),
    ).toEqual(["src/renamed-from.ts"]);
  });

  it("a CRLF RETRO still exempts its Applied files", () => {
    expect(
      unownedChangedFiles(
        [".claude/x.md"],
        [{ tasks, retroText: "## Applied\r\n\r\n- `.claude/x.md` edited\r\n" }],
      ),
    ).toEqual([]);
  });

  it("two hand-off tickets on one branch each get the unowned lines", () => {
    const goal = (id: string) =>
      `---\nticket_id: ${id}\nstage: handoff\ngoal_status: complete-pending-manual-commit\n---\n`;
    const plan = "```json tasks\n[]\n```\n";
    const lines = checkChangedFilesOwned(
      [
        { dir: "MF-0061", goalText: goal("MF-0061"), planText: plan },
        { dir: "MF-0062", goalText: goal("MF-0062"), planText: plan },
      ],
      [
        ".planning/tasks/MF-0061/GOAL.md",
        ".planning/tasks/MF-0062/GOAL.md",
        "src/a.ts",
      ],
    );
    expect(lines.map((l) => l.split(":")[0])).toEqual(["MF-0061", "MF-0062"]);
  });

  it("a grandfathered folder in the set (a re-freeze) lends its exemptions but not its owns (MF-0060 review 1)", () => {
    const handoff = `---\nticket_id: MF-0067\nstage: handoff\ngoal_status: complete-pending-manual-commit\n---\n`;
    const oldGoal = `---\nticket_id: MF-0058\nstage: handoff\ngoal_status: complete-pending-manual-commit\n---\n`;
    const plan = (owns: string[]) =>
      `\`\`\`json tasks\n${JSON.stringify([{ id: "T1", agent: "orchestrator", owns }])}\n\`\`\`\n`;
    const lines = checkChangedFilesOwned(
      [
        {
          dir: "MF-0067",
          goalText: handoff,
          planText: plan([".planning/tasks/MF-0067/**"]),
        },
        {
          dir: "MF-0058",
          goalText: oldGoal,
          planText: plan(["src/features/walk/**"]),
          frozenText: JSON.stringify({
            files: [
              { path: "src/features/walk/__tests__/a.acceptance.test.ts" },
            ],
          }),
        },
      ],
      [
        ".planning/tasks/MF-0067/GOAL.md",
        ".planning/tasks/MF-0058/FROZEN.json",
        "src/features/walk/__tests__/a.acceptance.test.ts",
        "src/features/walk/walk-session.test.tsx",
      ],
    );
    expect(lines).toEqual([
      `MF-0067: src/features/walk/walk-session.test.tsx is changed but in no task's owns. Add it to the owns of the task that wrote it in .planning/tasks/MF-0067/LOOP-PLAN.md (an "orchestrator" task for a file no role agent may write)`,
    ]);
  });
});

describe("check-planning.mjs on the CI ref shape (MF-0060 review 2)", () => {
  const ROOT = resolve(__dirname, "../../..");
  const fixture = mkdtempSync(join(tmpdir(), "mf-0060-ci-"));
  afterAll(() => rmSync(fixture, { recursive: true, force: true }));

  const env = {
    ...process.env,
    GIT_AUTHOR_NAME: "fixture",
    GIT_AUTHOR_EMAIL: "fixture@example.invalid",
    GIT_COMMITTER_NAME: "fixture",
    GIT_COMMITTER_EMAIL: "fixture@example.invalid",
  };
  const git = (repo: string, ...args: string[]): string =>
    spawnSync("git", args, { cwd: repo, encoding: "utf8", env }).stdout.trim();
  const put = (repo: string, path: string, text: string) => {
    mkdirSync(dirname(join(repo, path)), { recursive: true });
    writeFileSync(join(repo, path), text);
    git(repo, "add", path);
  };
  const snapshot = (repo: string, msg: string, ...parents: string[]) =>
    git(
      repo,
      "commit-tree",
      git(repo, "write-tree"),
      ...parents.flatMap((p) => ["-p", p]),
      "-m",
      msg,
    );

  /**
   * A: README. B (feature, from A): hand-off ticket MF-0061 + src/x.ts. C (main, from A): another ticket's
   * src/other.ts. HEAD = detached merge of C and B (what actions/checkout gives a PR), only refs/remotes/origin/main
   * = C, no local branch.
   */
  const ciRepo = (name: string, owns: string[]) => {
    const repo = join(fixture, name);
    mkdirSync(repo, { recursive: true });
    git(repo, "init", "-q", "-b", "scratch");
    put(repo, "README.md", "fixture\n");
    const a = snapshot(repo, "A");
    const goal = `---\nticket_id: MF-0061\nstage: handoff\ngoal_status: complete-pending-manual-commit\n---\n\n## Iteration Log\n\n- design preflight: none named.\n`;
    put(repo, ".planning/tasks/MF-0061/GOAL.md", goal);
    put(
      repo,
      ".planning/tasks/MF-0061/LOOP-PLAN.md",
      `\`\`\`json tasks\n${JSON.stringify([{ id: "T1", agent: "orchestrator", owns }])}\n\`\`\`\n`,
    );
    put(repo, ".planning/evidence/MF-0061.md", "## See it yourself\n\nn/a.\n");
    put(repo, "src/x.ts", "export {};\n");
    const b = snapshot(repo, "B", a);
    git(repo, "read-tree", a);
    put(repo, "src/other.ts", "export {};\n");
    const c = snapshot(repo, "C", a);
    git(repo, "read-tree", b);
    put(repo, "src/other.ts", "export {};\n");
    const merge = snapshot(repo, "merge", c, b);
    git(repo, "update-ref", "--no-deref", "HEAD", merge);
    git(repo, "read-tree", "-u", "--reset", merge);
    git(repo, "update-ref", "refs/remotes/origin/main", c);
    git(repo, "update-ref", "-d", "refs/heads/scratch");
    return repo;
  };
  const run = (repo: string) =>
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

  it("judges only the PR's files: main's src/other.ts is not swept in", () => {
    const repo = ciRepo("owned", ["src/x.ts"]);
    expect(git(repo, "for-each-ref", "--format=%(refname)")).toBe(
      "refs/remotes/origin/main",
    );
    const result = run(repo);
    expect(result.stdout).not.toContain("rule 2 skipped");
    expect(result.stdout).not.toContain("src/other.ts");
    expect(result.stderr).toBe("");
    expect(result.status).toBe(0);
  });

  it("flags the PR's own unowned file, and only it", () => {
    const result = run(ciRepo("unowned", ["docs/**"]));
    expect(result.stdout).toContain("MF-0061: src/x.ts is changed");
    expect(result.stdout).not.toContain("src/other.ts");
    expect(result.status).toBe(1);
  });
});
