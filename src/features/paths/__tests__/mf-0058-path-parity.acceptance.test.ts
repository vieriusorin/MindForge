/**
 * MF-0058 acceptance (SC-8, parity half): the Today Path card and the path page show the same
 * "Course n of N" and Continue target because both read `pathProgress` from `@/engine/path` (one
 * owner per figure). Read from the source: each route's import graph (its page and everything it
 * imports under src/, engine excluded) calls `pathProgress(` and imports it from the engine. The
 * card's absence when not enrolled and the rendered figures are browser proofs (GOAL SC-7, SC-8).
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const TODAY = join(SRC, "app", "(app)", "today", "page.tsx");
const PATH_PAGE = join(SRC, "app", "(app)", "paths", "[pathSlug]", "page.tsx");

const IMPORT = /(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g;
const SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx", ""];

function resolveImport(from: string, specifier: string): string | null {
  let base: string;
  if (specifier.startsWith("@/")) base = join(SRC, specifier.slice(2));
  else if (specifier.startsWith(".")) base = resolve(dirname(from), specifier);
  else return null;
  for (const suffix of SUFFIXES) {
    const candidate = base + suffix;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/** The route file plus every src/ file it reaches, minus the engine and the shadcn primitives. */
function importGraph(entry: string): Map<string, string> {
  const seen = new Map<string, string>();
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop();
    if (!file || seen.has(file)) continue;
    const text = readFileSync(file, "utf8");
    seen.set(file, text);
    for (const match of text.matchAll(IMPORT)) {
      const spec = match[1] ?? "";
      const target = resolveImport(file, spec);
      if (!target) continue;
      const rel = relative(SRC, target).split("\\").join("/");
      if (rel.startsWith("engine/") || rel.startsWith("components/ui/"))
        continue;
      queue.push(target);
    }
  }
  return seen;
}

function readsPathProgress(entry: string): string[] {
  return [...importGraph(entry)]
    .filter(
      ([, text]) =>
        /\bpathProgress\s*\(/.test(text) &&
        /import\s*\{[^}]*\bpathProgress\b[^}]*\}\s*from\s*["']@\/engine\/path["']/.test(
          text,
        ),
    )
    .map(([file]) => relative(ROOT, file).split("\\").join("/"));
}

describe("MF-0058 SC-8: Today and the path page read the same pathProgress", () => {
  it("SC-8: the path page /paths/[pathSlug] computes its progress with pathProgress", () => {
    expect(readsPathProgress(PATH_PAGE)).not.toEqual([]);
  });

  it("SC-8: Today's Path card computes its progress with pathProgress", () => {
    expect(readsPathProgress(TODAY)).not.toEqual([]);
  });
});
