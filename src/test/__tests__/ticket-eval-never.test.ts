import { describe, expect, it } from "vitest";
import { NEVER_GLOBS } from "../../../.claude/hooks/lib/agent-scopes.mjs";
import {
  globsOverlap,
  globToRegExp,
  validatePlan,
} from "../../../scripts/lib/ticket-eval.mjs";

describe("globsOverlap", () => {
  it.each([
    ["scripts/x.mjs", "scripts/**", true],
    ["scripts/generate/**", "scripts/**", true],
    ["**/*.json", "package.json", true],
    ["**", "pnpm-lock.yaml", true],
    [".planning/**", ".planning/tasks/*/FROZEN.json", true],
    [".planning/tasks/MF-0001/*.json", ".planning/tasks/*/FROZEN.json", true],
    [
      ".planning/tasks/MF-0001/LOOP-PLAN.md",
      ".planning/tasks/*/FROZEN.json",
      false,
    ],
    ["src/**/scripts/x.ts", "scripts/**", false],
    ["src/engine/**", "scripts/**", false],
    ["package.jso?", "package.json", true],
    ["package.json?", "package.json", false],
    ["pack*.json", "package.json", true],
    ["*.yaml", "pnpm-lock.yaml", true],
    ["*.yaml", ".github/**", false],
    ["a/**/b", "a/b", true],
    ["a/*/b", "a/b", false],
    ["*", ".husky/**", false],
    [".husky", ".husky/**", false],
    [".husky/x", ".husky/**", true],
  ])("%s vs %s -> %s", (a, b, expected) => {
    expect(globsOverlap(a, b)).toBe(expected);
    expect(globsOverlap(b, a)).toBe(expected);
  });

  it("agrees with globToRegExp on every sample path (brute-force cross-check)", () => {
    const globs = [
      "scripts/**",
      "**/*.json",
      ".planning/tasks/*/FROZEN.json",
      ".planning/**",
      "src/**",
      "*.yaml",
      "a/**/b",
      "a/*/b",
      "pack?ge.json",
    ];
    const samples = [
      "scripts/x.mjs",
      "scripts/a/b.json",
      "package.json",
      "packaxe.json",
      ".planning/tasks/MF-1/FROZEN.json",
      ".planning/evidence/x.md",
      "src/a.json",
      "pnpm-lock.yaml",
      "a/b",
      "a/x/b",
      "a/x/y/b",
      "x.yaml",
    ];
    for (const a of globs)
      for (const b of globs) {
        const witness = samples.some(
          (p) => globToRegExp(a).test(p) && globToRegExp(b).test(p),
        );
        // A shared sample proves overlap; the DP must never say "no" when a witness exists.
        if (witness) expect(globsOverlap(a, b), `${a} vs ${b}`).toBe(true);
      }
  });
});

describe("validatePlan owns syntax (fail closed)", () => {
  const plan = (owns: unknown[]) => [
    { id: "T1", agent: "service-builder", owns, closes: ["SC-1"] },
  ];
  it.each([
    ["/scripts/x.mjs"],
    ["./scripts/x.mjs"],
    ["../x"],
    ["scripts\\x.mjs"],
    ["scripts**"],
    ["src//x"],
    [""],
  ])("rejects owns %j", (owns) => {
    const errors = validatePlan(plan([owns]), ["SC-1"]);
    expect(errors.some((e: string) => e.startsWith("T1: owns"))).toBe(true);
  });

  it("rejects a non-string owns entry", () => {
    expect(
      validatePlan(plan([42]), ["SC-1"]).some((e: string) =>
        e.startsWith("T1: owns"),
      ),
    ).toBe(true);
  });

  // Review B1: an allowlist of segment shapes, not a list of known-bad ones.
  it.each([
    ["src/../scripts/x.mjs"],
    ["src/engine/../../package.json"],
    ["src/./x.ts"],
    ["C:/Users/me/MindForge/scripts/x.mjs"],
    [" scripts/x.mjs"],
    ["[s]cripts/x.mjs"],
    ["src/a b.ts"],
    ["…/D2.S1.yaml"],
    ["src/{a,{b,c}}/x.ts"],
    ["src/{a,b}{c,d}{e,f}{g,h}{i,j}{k,l}{m,n}/x.ts"],
  ])("rejects owns %j (review B1)", (owns) => {
    const errors = validatePlan(plan([owns]), ["SC-1"]);
    expect(errors.some((e: string) => e.startsWith("T1: owns"))).toBe(true);
  });

  it("accepts Next.js route segments and the repo's file names", () => {
    expect(
      validatePlan(
        plan([
          "src/app/(app)/play/[packSlug]/storm/**",
          "src/app/[...slug]/page.tsx",
          "src/app/[[...slug]]/page.tsx",
          "src/server/db/__tests__/mf-0013-storms.db.acceptance.test.ts",
          "supabase/migrations/*_mf0013_storms.sql",
          "CONTEXT.md",
          "packs/@scope+x/v?.yaml",
        ]),
        ["SC-1"],
      ),
    ).toEqual([]);
  });

  it("reads a brace set as alternatives and checks every one (shipped plans use them)", () => {
    expect(
      validatePlan(
        plan([
          "packs/platform-foundations/{questions,cards,diagrams}/D2.S*.yaml",
          "src/features/{duel,walk,seed-planting}/**",
        ]),
        ["SC-1"],
      ),
    ).toEqual([]);
    const hit = validatePlan(plan(["{src,scripts}/x.mjs"]), ["SC-1"]);
    expect(hit.some((e: string) => e.includes("NEVER glob scripts/**"))).toBe(
      true,
    );
  });

  it("matches NEVER case-insensitively: Scripts/ is scripts/ on Windows and macOS (review B1)", () => {
    for (const owns of [
      "Scripts/x.mjs",
      "PACKAGE.JSON",
      ".Claude/settings.json",
    ]) {
      const errors = validatePlan(plan([owns]), ["SC-1"]);
      expect(
        errors.some((e: string) => e.includes("NEVER")),
        owns,
      ).toBe(true);
    }
  });

  it("holds main-session tasks to the syntax rule, exempting them only from NEVER (review B2)", () => {
    const task = (owns: string[]) => [
      { id: "T1", agent: "inline", owns, closes: ["SC-1"] },
    ];
    expect(
      validatePlan(task(["./anything/**"]), ["SC-1"]).some((e: string) =>
        e.startsWith("T1: owns"),
      ),
    ).toBe(true);
    expect(validatePlan(task(["scripts/x.mjs"]), ["SC-1"])).toEqual([]);
  });
});

describe("NEVER_GLOBS", () => {
  it("is frozen, so no caller can change what validatePlan checks (review note)", () => {
    expect(Object.isFrozen(NEVER_GLOBS)).toBe(true);
  });
});
