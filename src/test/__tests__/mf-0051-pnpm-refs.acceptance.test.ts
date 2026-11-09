/**
 * MF-0051 acceptance (frozen): `node scripts/check-hooks.mjs` fails when a hook, the settings, an agent, a rule,
 * a skill's code or CLAUDE.md / AGENTS.md names `pnpm <name>` that is neither a package.json script nor a pnpm
 * built-in. Expected values come from GOAL.md SC-1…SC-3. Proof case: the retro Stop hook's
 * `1. pnpm ticket:retro <ID>` line (`.claude/hooks/lib/retro-trigger.mjs:78` before MF-0051).
 */
import { spawnSync } from "node:child_process";
import {
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import {
  isPnpmRefFile,
  unknownPnpmRefs,
} from "../../../scripts/lib/pnpm-refs.mjs";

const ROOT = resolve(__dirname, "../../..");
const roots: string[] = [];
afterAll(() => {
  for (const r of roots) rmSync(r, { recursive: true, force: true });
});

const PROOF_LINE =
  "  1. pnpm ticket:retro <ID>   (skip if RETRO.md exists and only step 3 is pending)";
const scripts = new Set(["test", "test:db", "ticket:github", "check:packs"]);

describe("MF-0051 pnpm references", () => {
  it("SC-1: the proof-case line names an unknown script", () => {
    expect(
      unknownPnpmRefs({ text: PROOF_LINE, markdown: false, scripts }),
    ).toEqual([{ line: 1, name: "ticket:retro" }]);
  });

  it("SC-1: known scripts, built-ins, `run`, trailing punctuation, placeholders and flags", () => {
    const text = [
      "run pnpm test:db, then pnpm ticket:github MF-0001.", // 1: known
      "pnpm exec biome check && pnpm dlx shadcn add x && pnpm install", // 2: built-ins
      "pnpm run check:nope", // 3: run <unknown>
      "see pnpm verify.", // 4: unknown, trailing dot
      "pnpm <script> and pnpm $" + "{name} and pnpm --filter web build", // 5: not names (a literal placeholder)
      "pnpm vitest run src", // 6: vitest bin (MF-0049)
      "pnpm db:test:start: then retry", // 7: unknown, trailing colon
    ].join("\n");
    expect(unknownPnpmRefs({ text, markdown: false, scripts })).toEqual([
      { line: 3, name: "check:nope" },
      { line: 4, name: "verify" },
      { line: 7, name: "db:test:start" },
    ]);
  });

  it("SC-1: in Markdown only code spans and fenced blocks count", () => {
    const text = [
      "Prose: pnpm doesn't hoist, and pnpm foo is just a word here.", // 1: prose, ignored
      "Run `pnpm ticket:verify <ID>` first.", // 2: code span
      "```", // 3
      "pnpm ticket:freeze MF-0001 a.test.ts", // 4: fenced
      "```", // 5
      "After the fence: pnpm bar is prose again.", // 6: ignored
      "````md", // 7: longer fence holds a shorter one
      "```", // 8
      "pnpm ticket:eval MF-0001", // 9: still fenced
      "````", // 10
    ].join("\n");
    expect(unknownPnpmRefs({ text, markdown: true, scripts })).toEqual([
      { line: 2, name: "ticket:verify" },
      { line: 4, name: "ticket:freeze" },
      { line: 9, name: "ticket:eval" },
    ]);
  });

  it("SC-2: check-hooks fails on a fixture root, naming the file, line and script", () => {
    const dir = mkdtempSync(join(tmpdir(), "mf0051-"));
    roots.push(dir);
    const put = (rel: string, text: string) => {
      mkdirSync(dirname(join(dir, rel)), { recursive: true });
      writeFileSync(join(dir, rel), text);
    };
    put(
      "package.json",
      JSON.stringify({ scripts: { test: "vitest", "ticket:github": "x" } }),
    );
    put(".claude/settings.json", "{}");
    put(".claude/hooks/x.mjs", `const msg = \`\n${PROOF_LINE}\n\`;\n`);
    put(
      ".claude/agents/a.md",
      "Prose pnpm foo here. Run `pnpm ticket:github`.\n",
    );
    const r = spawnSync(
      process.execPath,
      [join(ROOT, "scripts/check-hooks.mjs")],
      {
        cwd: ROOT,
        env: { ...process.env, MF_CHECK_ROOT: dir },
        encoding: "utf8",
      },
    );
    const out = `${r.stdout}\n${r.stderr}`.replaceAll("\\", "/");
    expect(r.status).toBe(1);
    expect(out).toContain(".claude/hooks/x.mjs:2");
    expect(out).toContain("pnpm ticket:retro");
    expect(out).not.toContain("pnpm foo");
    expect(out).not.toContain("pnpm ticket:github");
  });

  it("SC-3: no file in this repo names a pnpm script that does not exist", () => {
    const repoScripts = new Set(
      Object.keys(
        JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts,
      ),
    );
    // Re-freeze 2026-11-09 (review B-1): skip links like check-hooks does; the tracked
    // `.claude/skills/brag-slim` link dangles on Linux CI and statSync throws ENOENT there.
    const walk = (d: string): string[] =>
      readdirSync(d).flatMap((n) => {
        const p = join(d, n);
        const s = lstatSync(p);
        if (s.isSymbolicLink()) return [];
        return s.isDirectory() ? walk(p) : [p];
      });
    const files = [
      ...walk(join(ROOT, ".claude")),
      join(ROOT, "CLAUDE.md"),
      join(ROOT, "AGENTS.md"),
    ];
    const hits: string[] = [];
    for (const file of files) {
      const rel = relative(ROOT, file).replaceAll("\\", "/");
      const kind = isPnpmRefFile(rel);
      if (!kind) continue;
      for (const h of unknownPnpmRefs({
        text: readFileSync(file, "utf8"),
        markdown: kind.markdown,
        scripts: repoScripts,
      }))
        hits.push(`${rel}:${h.line} pnpm ${h.name}`);
    }
    expect(hits).toEqual([]);
  });
});
