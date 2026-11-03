/**
 * MF-0005 acceptance (SC-1, SC-2, SC-4, SC-5, SC-6): the shape of the CI workflow and its runbook.
 * The live run, the test PR and branch protection are proven in MF-0019. Files are read at
 * runtime, so a missing workflow is this test's red, not a compile error.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

const ROOT = process.cwd();
const WORKFLOW = join(ROOT, ".github/workflows/ci.yml");
const RUNBOOK = join(ROOT, "docs/runbook/ci.md");

interface Step {
  uses?: string;
  run?: string;
  if?: string;
  with?: Record<string, unknown>;
}
interface Job {
  steps?: Step[];
}
interface Workflow {
  on?: Record<string, { branches?: string[] } | null>;
  permissions?: unknown;
  jobs?: Record<string, Job>;
}

function readText(path: string): string {
  if (!existsSync(path)) throw new Error(`missing ${path}`);
  return readFileSync(path, "utf8");
}

function workflow(): Workflow {
  return parse(readText(WORKFLOW)) as Workflow;
}

function steps(job: string): Step[] {
  const found = workflow().jobs?.[job];
  if (!found) throw new Error(`job "${job}" is missing`);
  return found.steps ?? [];
}

/** Every command line of a job's `run:` steps, trimmed, in order. */
function commands(job: string): string[] {
  return steps(job).flatMap((s) =>
    (s.run ?? "")
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean),
  );
}

/** Index of the first command starting with each prefix; -1 when absent. */
function order(job: string, prefixes: string[]): number[] {
  const lines = commands(job);
  return prefixes.map((p) => lines.findIndex((l) => l.startsWith(p)));
}

function isAscendingAndPresent(indexes: number[]): boolean {
  return indexes.every((i, k) => i >= 0 && (k === 0 || i > indexes[k - 1]));
}

describe("MF-0005 CI workflow", () => {
  it("SC-1: runs on pull_request and push to main", () => {
    const on = workflow().on ?? {};
    expect(on.pull_request?.branches).toContain("main");
    expect(on.push?.branches).toContain("main");
  });

  it("SC-1: job `checks` runs install, typecheck, lint, test, hooks check, build in order", () => {
    const indexes = order("checks", [
      "pnpm install --frozen-lockfile",
      "pnpm typecheck",
      "pnpm lint",
      "pnpm test",
      "node scripts/check-hooks.mjs",
      "pnpm build",
    ]);
    expect(indexes, JSON.stringify(indexes)).toSatisfy(isAscendingAndPresent);
  });

  it("SC-1: Node 24, and pnpm from packageManager (no version override)", () => {
    for (const job of ["checks", "db"]) {
      const node = steps(job).find((s) =>
        s.uses?.startsWith("actions/setup-node@"),
      );
      expect(String(node?.with?.["node-version"])).toBe("24");
      const pnpm = steps(job).find((s) =>
        s.uses?.startsWith("pnpm/action-setup@"),
      );
      expect(pnpm).toBeDefined();
      expect(pnpm?.with?.version).toBeUndefined();
    }
  });

  it("SC-2: job `db` runs install, pinned `supabase start`, db:reset, test:db in order", () => {
    const indexes = order("db", [
      "pnpm install --frozen-lockfile",
      "pnpm exec supabase start",
      "pnpm db:reset",
      "pnpm test:db",
    ]);
    expect(indexes, JSON.stringify(indexes)).toSatisfy(isAscendingAndPresent);
  });

  it("SC-4: a PR-only step in `checks` warns about the key sync when questions change", () => {
    const reminder = steps("checks").find(
      (s) => s.run?.includes("::warning") && s.run.includes("db:sync-keys"),
    );
    expect(reminder, "no ::warning step naming db:sync-keys").toBeDefined();
    expect(reminder?.if ?? "").toContain("github.event_name == 'pull_request'");
    expect(reminder?.run ?? "").toMatch(/packs\/.*questions\//);
  });

  it("SC-5: the runbook names the required checks exactly as the workflow job ids", () => {
    const ids = Object.keys(workflow().jobs ?? {}).sort();
    expect(ids).toEqual(["checks", "db"]);
    const runbook = readText(RUNBOOK);
    expect(runbook).toMatch(/branch protection/i);
    for (const id of ids) expect(runbook).toContain(`\`${id}\``);
  });

  it("SC-6: no hosted project or secret is referenced", () => {
    const text = readText(WORKFLOW);
    for (const banned of [
      "secrets.",
      "--linked",
      "--project-ref",
      "SUPABASE_ACCESS_TOKEN",
    ])
      expect(text, banned).not.toContain(banned);
  });

  it("SC-6: every action is pinned to a full commit SHA, and the token is read-only", () => {
    const wf = workflow();
    expect(wf.permissions).toEqual({ contents: "read" });
    const uses = Object.values(wf.jobs ?? {}).flatMap((j) =>
      (j.steps ?? []).flatMap((s) => (s.uses ? [s.uses] : [])),
    );
    expect(uses.length).toBeGreaterThan(0);
    for (const u of uses) expect(u).toMatch(/^[\w.-]+\/[\w./-]+@[0-9a-f]{40}$/);
  });
});
