/**
 * MF-0049 acceptance (frozen): `pnpm check:goal-proofs <ID>` (scripts/check-goal-proofs.mjs) fails when a Success
 * Criterion's `Proof:` names a path, test file or pnpm script that does not exist, when a frozen file is named in no
 * ticket record, and when an SC has no `Proof:`. It fails closed on records it cannot read. Runs the real CLI over
 * fixture task dirs (`MF_TASKS_DIR`). Expected values come from GOAL.md SC-1…SC-4. Proof case: MF-0024 SC-3's path
 * `mf-0024-sync-prefix.db.acceptance.test.ts`, reconstructed from today's MF-0024 GOAL (F-1).
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

const ROOT = resolve(__dirname, "../../..");
const SCRIPT = join(ROOT, "scripts/check-goal-proofs.mjs");
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

/** A tasks dir holding one ticket with these record files. */
function tasks(id: string, records: Record<string, string>): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0049-"));
  roots.push(dir);
  mkdirSync(join(dir, id));
  for (const [name, text] of Object.entries(records))
    writeFileSync(join(dir, id, name), text);
  return dir;
}

function run(id: string, tasksDir?: string) {
  return spawnSync(process.execPath, [SCRIPT, id], {
    cwd: ROOT,
    env: { ...process.env, MF_TASKS_DIR: tasksDir ?? "" },
    encoding: "utf8",
  });
}

const goal = (...scs: string[]): string =>
  `---\nticket_id: MF-9999\nstage: test\n---\n\n## Objective\n\nX.\n\n## Success Criteria\n\n${scs.join("\n")}\n\n## Constraints\n\n- none\n`;

const real = (rel: string): string =>
  readFileSync(join(ROOT, ".planning/tasks/MF-0024", rel), "utf8");

describe("MF-0049 check:goal-proofs", () => {
  it("SC-1: a Proof path that does not exist fails, naming the SC and the path (MF-0024 proof case)", () => {
    const badGoal = real("GOAL.md").replace(
      "mf-0024-id-prefix.db.acceptance.test.ts",
      "mf-0024-sync-prefix.db.acceptance.test.ts",
    );
    expect(badGoal).toContain("mf-0024-sync-prefix.db.acceptance.test.ts");
    const dir = tasks("MF-0024", {
      "GOAL.md": badGoal,
      "LOOP-PLAN.md": real("LOOP-PLAN.md"),
      "LOOP-VERIFY.md": real("LOOP-VERIFY.md"),
      "FROZEN.json": real("FROZEN.json"),
    });
    const result = run("MF-0024", dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toMatch(
      /SC-3\b.*mf-0024-sync-prefix\.db\.acceptance\.test\.ts/,
    );

    // A Proof: after sub-bullets and a blank line is still read; placeholders are skipped, real misses are not.
    const wrapped = goal(
      "- [ ] SC-1: a rule with parts:",
      "  - part one;",
      "  - part two.",
      "",
      "  Not paths: `packs/<slug>/pack.yaml`, `src/**`. Proof: unit test `src/engine/nope/__tests__/missing.test.ts`.",
    );
    const r2 = run("MF-9999", tasks("MF-9999", { "GOAL.md": wrapped }));
    expect(r2.status).toBe(1);
    expect(r2.stderr).toContain("src/engine/nope/__tests__/missing.test.ts");
    expect(r2.stderr).not.toContain("<slug>");
  });

  it("SC-2: a frozen file named in no record fails, naming it", () => {
    const dir = tasks("MF-9999", {
      "GOAL.md": goal(
        "- [ ] SC-1: x. Proof: frozen acceptance test `src/test/__tests__/mf-0049-goal-proofs.acceptance.test.ts`.",
      ),
      "FROZEN.json": JSON.stringify({
        files: [
          { path: "src/test/__tests__/mf-0049-goal-proofs.acceptance.test.ts" },
          {
            path: "src/test/__tests__/mf-0046-workspace-check.acceptance.test.ts",
          },
        ],
      }),
    });
    const result = run("MF-9999", dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(
      "src/test/__tests__/mf-0046-workspace-check.acceptance.test.ts",
    );
    expect(result.stderr).not.toContain("mf-0049-goal-proofs");
  });

  it("SC-3: a pnpm script named as proof must exist in package.json", () => {
    const dir = tasks("MF-9999", {
      "GOAL.md": goal(
        "- [ ] SC-1: x. Proof: `pnpm check:nope` exits 0.",
        "- [ ] SC-2: y. Proof: `pnpm gate:planning` and `pnpm exec biome check`.",
      ),
    });
    const result = run("MF-9999", dir);
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("pnpm check:nope");
    expect(result.stderr).not.toContain("gate:planning");
    expect(result.stderr).not.toContain("exec");
  });

  it("SC-4: fails closed on unreadable records and an SC without Proof:; resolvable proofs pass", () => {
    expect(run("MF-9999", tasks("MF-9999", {})).status).toBe(1);

    const badJson = run(
      "MF-9999",
      tasks("MF-9999", {
        "GOAL.md": goal("- [ ] SC-1: x. Proof: `pnpm test`."),
        "FROZEN.json": "{",
      }),
    );
    expect(badJson.status).toBe(1);
    expect(badJson.stderr).toContain("FROZEN.json");

    const noProof = run(
      "MF-9999",
      tasks("MF-9999", {
        "GOAL.md": goal(
          "- [ ] SC-1: x. Proof: `pnpm test`.",
          "- [ ] SC-2: y, with `Proof:` only in backticks.",
        ),
      }),
    );
    expect(noProof.status).toBe(1);
    expect(noProof.stderr).toMatch(/SC-2\b.*Proof/);

    const good = run(
      "MF-9999",
      tasks("MF-9999", {
        "GOAL.md": goal(
          "- [ ] SC-1: x. Proof: `pnpm test` over `src/test/__tests__/mf-0049-goal-proofs.acceptance.test.ts`.",
          "- [x] SC-2: y. Proof: unit test `mf-0046-workspace-check.acceptance.test.ts`.",
        ),
      }),
    );
    expect(good.stderr).toBe("");
    expect(good.status).toBe(0);

    const today = run("MF-0024");
    expect(today.stderr).toBe("");
    expect(today.status).toBe(0);
  });
});
