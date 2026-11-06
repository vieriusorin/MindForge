/**
 * MF-0058 acceptance (SC-1): a path file validates with zod, `paths/claude-developer.yaml` names the
 * five Claude Developer courses MindForge has, in Anthropic's order, and the check names the path
 * and the slug for an unknown pack, a duplicate pack, an empty list and a pack with 0 skills.
 * Expected values are literals from .planning/tasks/MF-0058/GOAL.md (SC-1, Facts, "Decided without a
 * question"). The path file is read at runtime, never imported.
 *
 * The check runs inside `pnpm check:packs` (scripts/check-pack-grounding.mjs). The script reads path
 * files from `paths/`, or from `MF_PATHS_DIR` when set (as `MF_PACKS_DIR` does for packs), and
 * prints one line per problem to stderr.
 */
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { checkPath, parsePath } from "@/engine/path";

const ROOT = process.cwd();
const CLAUDE_DEVELOPER = join(ROOT, "paths", "claude-developer.yaml");

/** Skill counts per pack, from GOAL.md Facts (re-derived 2026-11-06). */
const PACK_SKILLS: ReadonlyMap<string, number> = new Map([
  ["ai-capabilities", 8],
  ["platform-foundations", 9],
  ["claude-code-in-action", 11],
  ["agent-skills", 9],
  ["subagents", 8],
  ["prod-prompting", 12],
  ["empty-course", 0],
]);

function pathYaml(slug: string, courses: readonly string[]): string {
  const list =
    courses.length === 0
      ? "courses: []"
      : `courses:\n${courses.map((c) => `  - ${c}`).join("\n")}`;
  return [
    `slug: ${slug}`,
    `name: Test path ${slug}`,
    "source: https://anthropic-partners.skilljar.com/path/claude-developer",
    list,
    "",
  ].join("\n");
}

function linesNaming(problems: readonly string[], ...words: string[]) {
  return problems.filter((p) => words.every((w) => p.includes(w)));
}

describe("MF-0058 SC-1: the path schema", () => {
  it("SC-1: a path with slug, name, source url and ordered courses parses, keeping the order", () => {
    const path = parsePath(
      pathYaml("demo-path", ["subagents", "ai-capabilities"]),
      "paths/demo-path.yaml",
    );
    expect(path.slug).toBe("demo-path");
    expect(path.name).toBe("Test path demo-path");
    expect(path.source).toBe(
      "https://anthropic-partners.skilljar.com/path/claude-developer",
    );
    expect([...path.courses]).toEqual(["subagents", "ai-capabilities"]);
  });

  it("SC-1: a path missing its source url, its name or its courses is refused", () => {
    const missingSource = "slug: p\nname: P\ncourses:\n  - subagents\n";
    const missingName =
      "slug: p\nsource: https://example.com/p\ncourses:\n  - subagents\n";
    const missingCourses = "slug: p\nname: P\nsource: https://example.com/p\n";
    expect(() => parsePath(missingSource, "paths/p.yaml")).toThrow(
      /paths\/p\.yaml/,
    );
    expect(() => parsePath(missingName, "paths/p.yaml")).toThrow(
      /paths\/p\.yaml/,
    );
    expect(() => parsePath(missingCourses, "paths/p.yaml")).toThrow(
      /paths\/p\.yaml/,
    );
  });

  it("SC-1: paths/claude-developer.yaml lists exactly the five courses, in Anthropic's order", () => {
    const path = parsePath(
      readFileSync(CLAUDE_DEVELOPER, "utf8"),
      "paths/claude-developer.yaml",
    );
    expect(path.slug).toBe("claude-developer");
    expect(path.source).toBe(
      "https://anthropic-partners.skilljar.com/path/claude-developer",
    );
    expect([...path.courses]).toEqual([
      "ai-capabilities",
      "platform-foundations",
      "claude-code-in-action",
      "agent-skills",
      "subagents",
    ]);
  });

  it("SC-1: paths/claude-developer.yaml passes the check", () => {
    expect(
      checkPath({
        file: "paths/claude-developer.yaml",
        text: readFileSync(CLAUDE_DEVELOPER, "utf8"),
        packSkillCounts: PACK_SKILLS,
      }),
    ).toEqual([]);
  });
});

describe("MF-0058 SC-1: the check names the path and the slug", () => {
  const check = (slug: string, courses: readonly string[]) =>
    checkPath({
      file: `paths/${slug}.yaml`,
      text: pathYaml(slug, courses),
      packSkillCounts: PACK_SKILLS,
    });

  it("SC-1: an unknown pack", () => {
    const problems = check("bad-unknown", ["ai-capabilities", "no-such-pack"]);
    expect(linesNaming(problems, "bad-unknown", "no-such-pack")).toHaveLength(
      1,
    );
  });

  it("SC-1: a duplicate pack", () => {
    const problems = check("bad-duplicate", [
      "ai-capabilities",
      "subagents",
      "ai-capabilities",
    ]);
    expect(
      linesNaming(problems, "bad-duplicate", "ai-capabilities"),
    ).toHaveLength(1);
  });

  it("SC-1: an empty list", () => {
    const problems = check("bad-empty", []);
    expect(linesNaming(problems, "bad-empty")).not.toEqual([]);
  });

  it("SC-1: a pack with 0 skills", () => {
    const problems = check("bad-zero", ["ai-capabilities", "empty-course"]);
    expect(linesNaming(problems, "bad-zero", "empty-course")).toHaveLength(1);
  });
});

describe("MF-0058 SC-1: pnpm check:packs runs the path check", () => {
  const dir = mkdtempSync(join(tmpdir(), "mf0058-paths-"));
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  function runCheck(files: Record<string, string>) {
    const caseDir = mkdtempSync(join(dir, "case-"));
    for (const [name, text] of Object.entries(files))
      writeFileSync(join(caseDir, name), text);
    const run = spawnSync(
      process.execPath,
      [join(ROOT, "scripts", "check-pack-grounding.mjs")],
      {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, MF_PATHS_DIR: caseDir },
      },
    );
    return {
      status: run.status,
      problems: run.stderr.split("\n").filter(Boolean),
    };
  }

  it("SC-1: exits 1 and names the path and the unknown pack", () => {
    const run = runCheck({
      "bad-unknown.yaml": pathYaml("bad-unknown", [
        "ai-capabilities",
        "no-such-pack",
      ]),
    });
    expect(
      linesNaming(run.problems, "bad-unknown", "no-such-pack"),
    ).toHaveLength(1);
    expect(run.status).toBe(1);
  });

  it("SC-1: exits 1 and names the path and the duplicate pack", () => {
    const run = runCheck({
      "bad-duplicate.yaml": pathYaml("bad-duplicate", [
        "subagents",
        "agent-skills",
        "subagents",
      ]),
    });
    expect(
      linesNaming(run.problems, "bad-duplicate", "subagents"),
    ).toHaveLength(1);
    expect(run.status).toBe(1);
  });

  it("SC-1: exits 1 and names the path with an empty list", () => {
    const run = runCheck({ "bad-empty.yaml": pathYaml("bad-empty", []) });
    expect(linesNaming(run.problems, "bad-empty")).not.toEqual([]);
    expect(run.status).toBe(1);
  });
});
