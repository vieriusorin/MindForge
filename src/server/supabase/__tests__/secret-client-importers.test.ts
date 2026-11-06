/**
 * ADR 0004 / MF-0011 and ADR 0006 / MF-0058: the secret-key client bypasses RLS, so exactly two
 * files may import it (the heatmap read and the course-completion write), and no client code may
 * name the key. A third importer is a decision for a new ADR, not a test edit.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

const files = sourceFiles(SRC)
  .filter((path) => !path.includes("__tests__"))
  .map((path) => ({
    rel: relative(process.cwd(), path).split("\\").join("/"),
    text: readFileSync(path, "utf8"),
  }));

describe("secret-key client", () => {
  it("is imported by get-group-heatmap.ts and record-course-completion.ts only", () => {
    const importers = files
      // any string literal naming the module: static import, dynamic import(), require(), re-export
      .filter((f) => /["'`][^"'`]*supabase\/secret(\.ts)?["'`]/.test(f.text))
      .map((f) => f.rel)
      .sort();
    expect(importers).toEqual([
      "src/server/groups/get-group-heatmap.ts",
      "src/server/paths/record-course-completion.ts",
    ]);
  });

  it("names SUPABASE_SECRET_KEY in secret.ts only, and never as NEXT_PUBLIC_", () => {
    const naming = files
      .filter((f) => f.text.includes("SUPABASE_SECRET_KEY"))
      .map((f) => f.rel);
    expect(naming).toEqual(["src/server/supabase/secret.ts"]);
    expect(
      files.some((f) => f.text.includes("NEXT_PUBLIC_SUPABASE_SECRET")),
    ).toBe(false);
  });
});
