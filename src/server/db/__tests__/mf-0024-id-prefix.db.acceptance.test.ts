// MF-0024 acceptance (frozen): no pack can claim another pack's id. Runs against the LOCAL stack
// (`pnpm test:db`). SC-3: the key sync refuses (folder ≠ slug; a pack reusing another pack's id) and
// writes nothing. SC-5: the database itself refuses a key or item row whose id prefix ≠ pack_slug.
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "@/test/local-stack";

const ROOT = resolve(import.meta.dirname, "../../../..");
const SCRIPT = join(ROOT, "scripts", "sync-question-keys.mjs");
const VICTIM = "ccdv-f.D1.S1.q1"; // a shipped ccdv-f question
const FOLDER = "mf0024-folder"; // SC-3a: folder name
const OTHER = "mf0024-other"; // SC-3a: the slug its pack.yaml declares
const THIEF = "mf0024-thief"; // SC-3b: a pack that reuses VICTIM's id
const SC5_A = "mf0024-a";
const SC5_B = "mf0024-b";
const FIXTURE_SLUGS = [FOLDER, OTHER, THIEF, SC5_A, SC5_B];

const question = (id: string): string => `skill: W.1
questions:
  - id: ${id}
    origin: official
    stem: Which option is right?
    select: 1
    options:
      - { id: A, text: This one, correct: true, rationale: It is. }
      - { id: B, text: That one, correct: false, rationale: It is not. }
    source: { title: Doc, url: "https://example.com/doc" }
`;

const SAMPLE_PACK = readFileSync(
  join(ROOT, "packs", "team-onboarding-sample", "pack.yaml"),
  "utf8",
);

const dirs: string[] = [];
let db: ReturnType<typeof sql>;
beforeAll(() => {
  db = sql();
});

/** A temp copy of the real packs plus one extra folder `folder` whose pack.yaml says `slug`. */
function packsWith(folder: string, slug: string, questionId: string): string {
  const dir = mkdtempSync(join(tmpdir(), "mf0024-packs-"));
  dirs.push(dir);
  cpSync(join(ROOT, "packs"), dir, { recursive: true });
  mkdirSync(join(dir, folder, "questions"), { recursive: true });
  writeFileSync(
    join(dir, folder, "pack.yaml"),
    SAMPLE_PACK.replace(/^slug: .*$/m, `slug: ${slug}`),
  );
  writeFileSync(
    join(dir, folder, "questions", "w1.yaml"),
    question(questionId),
  );
  return dir;
}

function sync(packsDir?: string): ReturnType<typeof spawnSync> {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.SUPABASE_DB_URL;
  if (packsDir) env.MINDFORGE_PACKS_DIR = packsDir;
  else delete env.MINDFORGE_PACKS_DIR;
  return spawnSync(process.execPath, [SCRIPT], {
    cwd: ROOT,
    env,
    encoding: "utf8",
  });
}

async function snapshot(): Promise<string> {
  const [packs, keys, items] = await Promise.all([
    db`select * from private.packs order by slug`,
    db`select * from private.question_keys order by question_id`,
    db`select * from private.items order by item_id`,
  ]);
  return JSON.stringify({ packs, keys, items });
}

async function victimPack(): Promise<string | undefined> {
  const rows = await db<{ pack_slug: string }[]>`
    select pack_slug from private.question_keys where question_id = ${VICTIM}`;
  return rows[0]?.pack_slug;
}

/** The SQLSTATE of `run`, or "ok" when it succeeds. */
async function sqlState(run: () => Promise<unknown>): Promise<string> {
  try {
    await run();
    return "ok";
  } catch (error) {
    return String((error as { code?: unknown }).code);
  }
}

afterAll(async () => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true });
  await db`delete from private.items where pack_slug = any(${FIXTURE_SLUGS})`;
  await db`delete from private.question_keys where pack_slug = any(${FIXTURE_SLUGS})`;
  const registered = await db`
    select 1 from private.packs where slug = any(${FIXTURE_SLUGS})`;
  // A run that did write (the pre-fix red) moved VICTIM or registered a fixture pack: re-sync the real packs.
  if ((await victimPack()) !== "ccdv-f" || registered.length) {
    const run = sync();
    if (run.status !== 0) throw new Error(`restore sync failed: ${run.stderr}`);
  }
  await db`delete from private.packs where slug = any(${FIXTURE_SLUGS})`;
  await db.end();
});

describe("MF-0024 cross-pack ids (DB)", () => {
  it("SC-3: a pack whose folder is not its slug is refused; no row changes", async () => {
    expect(await victimPack(), "ccdv-f not synced: run pnpm db:sync-keys").toBe(
      "ccdv-f",
    );
    const before = await snapshot();
    const run = sync(packsWith(FOLDER, OTHER, `${OTHER}.W.1.q1`));
    const after = await snapshot();

    expect(run.status, String(run.stdout)).not.toBe(0);
    expect(String(run.stderr)).toContain("Not syncing");
    expect(String(run.stderr)).toContain(FOLDER);
    expect(String(run.stderr)).toContain(OTHER);
    expect(after).toBe(before);
  });

  it("SC-3: a pack reusing another pack's id is refused; the key stays in its pack", async () => {
    expect(await victimPack(), "ccdv-f not synced: run pnpm db:sync-keys").toBe(
      "ccdv-f",
    );
    const before = await snapshot();
    const run = sync(packsWith(THIEF, THIEF, VICTIM));
    const after = await snapshot();

    expect(run.status, String(run.stdout)).not.toBe(0);
    expect(String(run.stderr)).toContain("Not syncing");
    expect(String(run.stderr)).toContain(
      `id "${VICTIM}" must start with "${THIEF}."`,
    );
    expect(after).toBe(before);
    expect(await victimPack()).toBe("ccdv-f");
  });

  it("SC-5: question_keys refuses an id whose prefix is not pack_slug (23514); a matching row inserts", async () => {
    const id = `${SC5_A}.S1.q1`;
    expect(
      await sqlState(
        () => db`insert into private.question_keys (question_id, pack_slug, skill_code, correct_options)
                 values (${id}, ${SC5_B}, 'S1', ${["A"]})`,
      ),
    ).toBe("23514");
    expect(
      await sqlState(
        () => db`insert into private.question_keys (question_id, pack_slug, skill_code, correct_options)
                 values (${id}, ${SC5_A}, 'S1', ${["A"]})`,
      ),
    ).toBe("ok");
  });

  it("SC-5: items refuses an id whose prefix is not pack_slug (23514); a matching row inserts", async () => {
    const id = `${SC5_A}.S1.c1`;
    expect(
      await sqlState(
        () => db`insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
                 values (${id}, ${SC5_B}, 'S1', 'card', 'h', 'official')`,
      ),
    ).toBe("23514");
    expect(
      await sqlState(
        () => db`insert into private.items (item_id, pack_slug, skill_code, item_type, content_hash, origin)
                 values (${id}, ${SC5_A}, 'S1', 'card', 'h', 'official')`,
      ),
    ).toBe("ok");
  });
});
