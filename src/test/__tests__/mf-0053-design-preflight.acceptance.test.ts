/**
 * MF-0053 acceptance (frozen): `pnpm gate:planning` also fails a GOAL.md past DESIGN whose Success
 * Criteria name a `pnpm <script>` that its Iteration Log's "design preflight" line does not mention.
 * Expected values come from GOAL.md SC-1…SC-5, not from the checker.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkDesignPreflight } from "../../../scripts/lib/planning-check.mjs";

const ROOT = resolve(__dirname, "../../..");

const SCRIPTS = [
  "typecheck",
  "lint",
  "test",
  "test:db",
  "build",
  "db:reset",
  "dev:seed",
  "gate:planning",
];

interface GoalParts {
  id?: string;
  stage?: string;
  status?: string;
  sc: string;
  log?: string;
  objective?: string;
}

const goal = ({
  id = "MF-0060",
  stage = "build",
  status = "in-progress",
  sc,
  log = "",
  objective = "Text.",
}: GoalParts): string =>
  [
    "---",
    `ticket_id: ${id}`,
    "tier: normal",
    `stage: ${stage}`,
    `goal_status: ${status}`,
    "---",
    "",
    "## Objective",
    "",
    objective,
    "",
    "## Success Criteria",
    "",
    sc,
    "",
    "## Out of Scope",
    "",
    "- `pnpm db:reset` is mentioned here, outside the SCs.",
    "",
    "## Iteration Log",
    "",
    log,
    "",
  ].join("\n");

const check = (dir: string, text: string | null): string[] =>
  checkDesignPreflight([{ dir, goalText: text }], SCRIPTS);

describe("MF-0053 checkDesignPreflight", () => {
  it("SC-1: a script named by an SC and missing from the preflight line is one problem line, in SC order", () => {
    const text = goal({
      sc: "- **SC-1** proof: `pnpm build`.\n- **SC-2** proof: `pnpm test:db` and `pnpm test`.",
      log: "- 2026-11-05 design preflight: `pnpm test` exit 0.",
    });
    expect(check("MF-0060", text)).toEqual([
      "MF-0060: design preflight does not mention pnpm build, pnpm test:db, named by an SC",
    ]);
  });

  it("SC-1: every named script mentioned → no problem; `pnpm run <s>` in an SC counts as <s>", () => {
    const text = goal({
      sc: "- **SC-1** proof: `pnpm run build` and `pnpm test`.",
      log: "- 2026-11-05 Design Preflight: `pnpm test` ok; `pnpm build` not run: no UI.",
    });
    expect(check("MF-0060", text)).toEqual([]);
  });

  it("SC-1: whole-name matching — pnpm test does not cover pnpm test:db", () => {
    const text = goal({
      sc: "- **SC-1** proof: `pnpm test:db`.",
      log: "- design preflight: `pnpm test` exit 0.",
    });
    expect(check("MF-0060", text)).toEqual([
      "MF-0060: design preflight does not mention pnpm test:db, named by an SC",
    ]);
  });

  it("SC-1: whole-name matching — pnpm test:db does not cover pnpm test", () => {
    const text = goal({
      sc: "- **SC-1** proof: `pnpm test`.",
      log: "- design preflight: `pnpm test:db` exit 0.",
    });
    expect(check("MF-0060", text)).toEqual([
      "MF-0060: design preflight does not mention pnpm test, named by an SC",
    ]);
  });

  it("SC-1: a mention on a different Iteration Log line does not count", () => {
    const text = goal({
      sc: "- **SC-1** proof: `pnpm build`.",
      log: "- design preflight: `pnpm test` ok.\n- 2026-11-06 BUILD: `pnpm build` exit 0.",
    });
    expect(check("MF-0060", text)).toEqual([
      "MF-0060: design preflight does not mention pnpm build, named by an SC",
    ]);
  });

  it("SC-2: in scope with no design preflight line in the Iteration Log", () => {
    const text = goal({
      stage: "test",
      sc: "- **SC-1** proof: `pnpm test`.",
      log: "- 2026-11-05 BUILD done.",
      objective: "The design preflight said so (outside the Iteration Log).",
    });
    expect(check("MF-0060", text)).toEqual([
      'MF-0060: stage test but no "design preflight" line in the Iteration Log',
    ]);
  });

  it("SC-2: applies to every stage past design", () => {
    for (const stage of ["plan", "build", "test", "handoff", "watch"]) {
      const text = goal({ stage, sc: "- **SC-1** none." });
      expect(check("MF-0060", text)).toEqual([
        `MF-0060: stage ${stage} but no "design preflight" line in the Iteration Log`,
      ]);
    }
  });

  it("SC-3: out of scope → no problem (cutoff, reserved, intake/design, no GOAL)", () => {
    const bad = { sc: "- **SC-1** proof: `pnpm build`." };
    expect(check("MF-0052", goal({ id: "MF-0052", ...bad }))).toEqual([]);
    expect(check("MF-0025", goal({ id: "MF-0025", ...bad }))).toEqual([]);
    expect(check("MF-0060", goal({ status: "reserved", ...bad }))).toEqual([]);
    expect(check("MF-0060", goal({ stage: "intake", ...bad }))).toEqual([]);
    expect(check("MF-0060", goal({ stage: "design", ...bad }))).toEqual([]);
    expect(check("MF-0060", null)).toEqual([]);
  });

  it("SC-3: pnpm <x> where x is not a script is ignored", () => {
    const text = goal({
      sc: "- **SC-1** run `pnpm exec biome check` and `pnpm dlx shadcn@latest add x`.",
      log: "- design preflight: nothing named.",
    });
    expect(check("MF-0060", text)).toEqual([]);
  });

  it("SC-3: CRLF text gives the same result as LF", () => {
    const text = goal({
      sc: "- **SC-1** proof: `pnpm build`.",
      log: "- design preflight: `pnpm test` ok.",
    });
    expect(check("MF-0060", text.replace(/\n/g, "\r\n"))).toEqual(
      check("MF-0060", text),
    );
    expect(check("MF-0060", text)).toHaveLength(1);
  });

  it("SC-1/SC-2: one line per bad folder, good folders add none", () => {
    const problems = checkDesignPreflight(
      [
        {
          dir: "MF-0060",
          goalText: goal({
            sc: "- `pnpm lint`.",
            log: "- design preflight: `pnpm lint` ok.",
          }),
        },
        {
          dir: "MF-0061",
          goalText: goal({ id: "MF-0061", sc: "- `pnpm build`." }),
        },
        {
          dir: "MF-0062",
          goalText: goal({
            id: "MF-0062",
            sc: "- `pnpm build`.",
            log: "- design preflight: `pnpm lint`.",
          }),
        },
      ],
      SCRIPTS,
    );
    expect(problems).toEqual([
      'MF-0061: stage build but no "design preflight" line in the Iteration Log',
      "MF-0062: design preflight does not mention pnpm build, named by an SC",
    ]);
  });
});

describe("MF-0053 proof-case replay (verbatim GOALs at 8b1aa89)", () => {
  const show = (path: string): string => {
    const run = spawnSync("git", ["show", `8b1aa89:${path}`], {
      cwd: ROOT,
      encoding: "utf8",
    });
    if (run.status !== 0) throw new Error(`git show ${path}: ${run.stderr}`);
    return run.stdout;
  };
  const repoScripts = (): string[] => {
    const pkg = JSON.parse(show("package.json"));
    return Object.keys(pkg.scripts);
  };

  it("SC-4: MF-0052 misses build, db:reset, dev:seed and test:db", () => {
    const problems = checkDesignPreflight(
      [
        {
          dir: "MF-0060",
          goalText: show(".planning/tasks/MF-0052/GOAL.md"),
        },
      ],
      repoScripts(),
    );
    expect(problems).toHaveLength(1);
    expect(problems[0]).toMatch(
      /^MF-0060: design preflight does not mention .*, named by an SC$/,
    );
    const named = [
      ...problems[0]
        .replace(/, named by an SC$/, "")
        .matchAll(/pnpm (\S+?)(?:,|$)/g),
    ].map((m) => m[1]);
    expect(new Set(named)).toEqual(
      new Set(["build", "db:reset", "dev:seed", "test:db"]),
    );
  });

  it("SC-4: MF-0025 has no design preflight line", () => {
    expect(
      checkDesignPreflight(
        [
          {
            dir: "MF-0061",
            goalText: show(".planning/tasks/MF-0025/GOAL.md"),
          },
        ],
        repoScripts(),
      ),
    ).toEqual([
      'MF-0061: stage handoff but no "design preflight" line in the Iteration Log',
    ]);
  });
});

describe("MF-0053 scripts/check-planning.mjs", () => {
  const fixture = mkdtempSync(join(tmpdir(), "mf-0053-"));
  afterAll(() => rmSync(fixture, { recursive: true, force: true }));

  const runCli = (tasksDir?: string) =>
    spawnSync(process.execPath, [join(ROOT, "scripts/check-planning.mjs")], {
      cwd: ROOT,
      encoding: "utf8",
      env: { ...process.env, MF_TASKS_DIR: tasksDir ?? "" },
    });

  it("SC-5: exits 1 and prints the SC-1 line for a bad MF-0060, using package.json scripts", () => {
    const tasks = join(fixture, "tasks");
    const write = (dir: string, text: string) => {
      mkdirSync(join(tasks, dir), { recursive: true });
      writeFileSync(join(tasks, dir, "GOAL.md"), text);
    };
    write(
      "MF-0060",
      goal({
        sc: "- proof: `pnpm build` and `pnpm check:packs`.",
        log: "- design preflight: `pnpm test` ok.",
      }),
    );
    write(
      "MF-0061",
      goal({ id: "MF-0061", stage: "design", sc: "- `pnpm build`." }),
    );

    const run = runCli(tasks);
    expect(run.status).toBe(1);
    expect(run.stdout).toContain(
      "MF-0060: design preflight does not mention pnpm build, pnpm check:packs, named by an SC",
    );
    expect(run.stdout).not.toContain("MF-0061: ");
  });

  it("SC-5: exits 0 on this repo's .planning/tasks", () => {
    const run = runCli();
    expect(run.stderr).toBe("");
    expect(run.status).toBe(0);
  });
});
