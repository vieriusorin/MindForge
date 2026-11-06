/**
 * MF-0048 acceptance (frozen): `validatePlan` reports a role-agent task whose `owns` can match a path role agents may
 * never write (`NEVER_GLOBS` in .claude/hooks/lib/agent-scopes.mjs), accepts main-session tasks (`inline`,
 * `orchestrator`), and reads the same NEVER list the scope hook enforces. Expected values come from GOAL.md SC-1…SC-4.
 * Proof case: MF-0013's shipped plan (T1 schema-builder → scripts/sync-question-keys.mjs, T6 service-builder →
 * .planning/evidence/MF-0013.md).
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  NEVER_GLOBS,
  scopeDecision,
} from "../../../.claude/hooks/lib/agent-scopes.mjs";
import {
  parsePlanTasks,
  validatePlan,
} from "../../../scripts/lib/ticket-eval.mjs";

const ROOT = resolve(__dirname, "../../..");

const task = (id: string, agent: string, owns: string[]) => ({
  id,
  agent,
  owns,
  depends_on: [],
  closes: ["SC-1"],
});

/** Errors from validatePlan that name the NEVER rule (other plan errors are not this ticket's). */
const neverErrors = (tasks: unknown[]): string[] =>
  validatePlan(tasks, ["SC-1"]).filter((e: string) => e.includes("NEVER"));

describe("MF-0048 plan owns vs NEVER", () => {
  it("SC-1: a role-agent owns entry that can match a NEVER glob is an error naming task, agent and path", () => {
    expect(
      neverErrors([task("T1", "service-builder", ["scripts/x.mjs"])]),
    ).toEqual([
      "T1: service-builder may not own scripts/x.mjs: it can match NEVER glob scripts/** (role agents never write it; agent-scopes.mjs)",
    ]);
    const inside = neverErrors([
      task("T2", "ui-builder", ["scripts/generate/**"]),
    ]);
    expect(inside).toHaveLength(1);
    expect(inside[0]).toContain(
      "T2: ui-builder may not own scripts/generate/**",
    );
    const covering = neverErrors([
      task("T3", "service-builder", ["**/*.json"]),
    ]);
    expect(covering.some((e) => e.includes("NEVER glob package.json"))).toBe(
      true,
    );
    expect(
      neverErrors([
        task("T4", "service-builder", ["src/engine/**", "packs/**"]),
      ]),
    ).toEqual([]);
  });

  it("SC-2: MF-0013's shipped plan yields exactly its two NEVER errors", () => {
    const { tasks, errors } = parsePlanTasks(
      readFileSync(join(ROOT, ".planning/tasks/MF-0013/LOOP-PLAN.md"), "utf8"),
    );
    expect(errors).toEqual([]);
    const found = neverErrors(tasks);
    expect(found).toHaveLength(2);
    expect(found[0]).toMatch(
      /^T1: schema-builder may not own scripts\/sync-question-keys\.mjs: /,
    );
    expect(found[1]).toMatch(
      /^T6: service-builder may not own \.planning\/evidence\/MF-0013\.md: /,
    );
  });

  it("SC-3: main-session tasks may own NEVER paths and are known agents", () => {
    const tasks = [
      task("T1", "inline", ["scripts/check-x.mjs", "package.json"]),
      task("T2", "orchestrator", [
        ".planning/evidence/MF-9999.md",
        ".claude/hooks/lib/x.mjs",
      ]),
    ];
    expect(validatePlan(tasks, ["SC-1"])).toEqual([]);
  });

  it("SC-4: the scope hook and the plan check share one NEVER list; the hook is unchanged", () => {
    expect(NEVER_GLOBS).toEqual([
      ".planning/evidence/**",
      ".planning/tasks/*/FROZEN.json",
      ".claude/**",
      "scripts/**",
      ".github/**",
      ".husky/**",
      "package.json",
      "pnpm-lock.yaml",
    ]);
    for (const glob of NEVER_GLOBS) {
      expect(
        neverErrors([task("T1", "service-builder", [glob])]),
        glob,
      ).toHaveLength(1);
    }
    expect(scopeDecision("service-builder", "scripts/x.mjs")).toMatch(
      /may not write scripts\/x\.mjs/,
    );
    expect(scopeDecision("service-builder", "src/engine/x.ts")).toBeNull();
    expect(scopeDecision(undefined, "scripts/x.mjs")).toBeNull();
  });
});
