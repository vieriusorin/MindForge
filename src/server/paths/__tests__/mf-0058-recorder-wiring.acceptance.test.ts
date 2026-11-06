/**
 * MF-0058 acceptance (SC-5 importer lock, SC-6 call sites), read from the source tree.
 * - SC-5 / C-2: the secret-key client is imported by exactly `get-group-heatmap.ts` (the read, ADR
 *   0004) and the completion recorder (the one write). Same detection as
 *   src/server/supabase/__tests__/secret-client-importers.test.ts.
 * - SC-6 / fact (d): the three grading paths call the recorder: `gradeAnswer` (duel, walk,
 *   seed-planting), `gradeCuckoo` (cuckoo) and the storm answer path.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const RECORDER = "src/server/paths/record-course-completion.ts";

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function rel(path: string): string {
  return relative(ROOT, path).split("\\").join("/");
}

const files = sourceFiles(join(ROOT, "src"))
  .filter((path) => !path.includes("__tests__"))
  .map((path) => ({ rel: rel(path), text: readFileSync(path, "utf8") }));

/** Files that call the recorder (the name followed by a call paren), excluding the recorder itself. */
function callers(): string[] {
  return files
    .filter((f) => f.rel !== RECORDER)
    .filter((f) => /\brecordCourseCompletion\s*\(/.test(f.text))
    .map((f) => f.rel);
}

describe("MF-0058 SC-5: the secret client has exactly two importers", () => {
  it("SC-5: get-group-heatmap.ts and the completion recorder, nothing else", () => {
    const importers = files
      .filter((f) => /["'`][^"'`]*supabase\/secret(\.ts)?["'`]/.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(importers).toEqual([
      "src/server/groups/get-group-heatmap.ts",
      "src/server/paths/record-course-completion.ts",
    ]);
  });
});

describe("MF-0058 SC-6: every grading path calls the recorder", () => {
  it("SC-6: gradeAnswer (duel, walk, seed-planting) calls recordCourseCompletion", () => {
    expect(callers()).toContain("src/server/attempts/grade-answer.ts");
  });

  it("SC-6: gradeCuckoo (cuckoo) calls recordCourseCompletion", () => {
    expect(callers()).toContain("src/server/attempts/grade-cuckoo.ts");
  });

  it("SC-6: the storm answer path calls recordCourseCompletion", () => {
    const storm = callers().filter(
      (f) =>
        f === "src/features/storm/actions.ts" ||
        f.startsWith("src/server/storm/"),
    );
    expect(storm).not.toEqual([]);
  });
});
