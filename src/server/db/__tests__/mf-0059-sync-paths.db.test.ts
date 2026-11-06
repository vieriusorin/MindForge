// MF-0059 T2: `db:sync-keys` writes the path registry (private.path_courses) from paths/*.yaml, and a
// bad path file refuses the whole sync before the first write (MF-0034 failure order). LOCAL stack only.
import { spawnSync } from "node:child_process";
import { cpSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/test/local-stack";

const ROOT = resolve(import.meta.dirname, "../../../..");
const SCRIPT = join(ROOT, "scripts", "sync-question-keys.mjs");
const COURSES = [
  "ai-capabilities",
  "platform-foundations",
  "claude-code-in-action",
  "agent-skills",
  "subagents",
];

function runSync(extra: Record<string, string> = {}) {
  const env: NodeJS.ProcessEnv = { ...process.env, ...extra };
  if (!("SUPABASE_DB_URL" in extra)) delete env.SUPABASE_DB_URL;
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env,
    encoding: "utf8",
  });
}

async function registry(): Promise<string[]> {
  const rows = await sql()<{ line: string }[]>`
    select path_slug || ':' || position || ':' || pack_slug as line
    from private.path_courses order by path_slug, position`;
  return rows.map((r) => r.line);
}

async function packCount(): Promise<number> {
  const [row] = await sql()<{ n: number }[]>`
    select count(*)::int as n from private.packs`;
  return row?.n ?? -1;
}

/** A copy of paths/ plus one extra file, so the good file is still there and the sync must refuse anyway. */
function pathsCopyWith(name: string, text: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0059-paths-"));
  cpSync(join(ROOT, "paths"), dir, { recursive: true });
  writeFileSync(join(dir, name), text);
  return dir;
}

const dirs: string[] = [];
const expected = COURSES.map((c, i) => `claude-developer:${i + 1}:${c}`);

beforeAll(() => {
  const run = runSync();
  if (run.status !== 0) throw new Error(`sync failed:\n${run.stderr}`);
});

afterAll(() => {
  for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("MF-0059 sync writes the path registry", () => {
  it("a real run writes claude-developer 1–5 in path order, and a second run changes nothing", async () => {
    expect(await registry()).toEqual(expected);
    const again = runSync();
    expect(again.status, again.stderr).toBe(0);
    expect(await registry()).toEqual(expected);
  });

  it("a path file missing its courses refuses the sync and writes nothing (MF-0034 order)", async () => {
    const packsBefore = await packCount();
    const dir = pathsCopyWith(
      "zz-broken.yaml",
      "slug: zz-broken\nname: Broken\nsource: https://example.com/\n",
    );
    dirs.push(dir);
    const run = runSync({ MINDFORGE_PATHS_DIR: dir });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("Not syncing: invalid path file");
    expect(await registry()).toEqual(expected);
    expect(await packCount()).toBe(packsBefore);
  });

  it("a path listing one course twice refuses the sync", async () => {
    const dir = pathsCopyWith(
      "zz-twice.yaml",
      "slug: zz-twice\nname: Twice\nsource: https://example.com/\ncourses:\n  - subagents\n  - subagents\n",
    );
    dirs.push(dir);
    const run = runSync({ MINDFORGE_PATHS_DIR: dir });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("zz-twice");
    expect(await registry()).toEqual(expected);
  });

  it("a file whose name is not its slug refuses the sync", async () => {
    const dir = pathsCopyWith(
      "zz-misnamed.yaml",
      "slug: other-slug\nname: Misnamed\nsource: https://example.com/\ncourses:\n  - subagents\n",
    );
    dirs.push(dir);
    const run = runSync({ MINDFORGE_PATHS_DIR: dir });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("zz-misnamed.yaml");
    expect(await registry()).toEqual(expected);
  });

  it("refuses MINDFORGE_PATHS_DIR together with SUPABASE_DB_URL before any DB call", () => {
    const run = runSync({
      MINDFORGE_PATHS_DIR: join(ROOT, "paths"),
      SUPABASE_DB_URL: "postgres://nobody@127.0.0.1:1/none",
    });
    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain(
      "Refusing MINDFORGE_PATHS_DIR together with SUPABASE_DB_URL",
    );
  });
});
