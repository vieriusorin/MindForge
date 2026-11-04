// MF-0012 acceptance (frozen): SC-5, the key sync refuses a pack the app's validator rejects and
// writes nothing. Runs against the LOCAL stack (`pnpm test:db`).
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
const BROKEN = "mf0012-broken";

// Passes the script's own checks (one correct option, valid origin) but not the app's schema:
// the source url is not http(s) (MF-0003 review: it is rendered as an href).
const BROKEN_QUESTIONS = `skill: W.1
questions:
  - id: ${BROKEN}.W.1.bad-source
    origin: official
    stem: Which option is right?
    select: 1
    options:
      - { id: A, text: This one, correct: true, rationale: It is. }
      - { id: B, text: That one, correct: false, rationale: It is not. }
    source: { title: Bad link, url: "javascript:alert(1)" }
`;

async function snapshot(): Promise<string> {
  const db = sql();
  const [packs, keys, items] = await Promise.all([
    db`select * from private.packs order by slug`,
    db`select * from private.question_keys order by question_id`,
    db`select * from private.items order by item_id`,
  ]);
  return JSON.stringify({ packs, keys, items });
}

async function removeFixtureRows(): Promise<void> {
  const db = sql();
  await db`delete from private.items where pack_slug = ${BROKEN}`;
  await db`delete from private.question_keys where pack_slug = ${BROKEN}`;
  await db`delete from private.packs where slug = ${BROKEN}`;
}

describe("MF-0012 sync-question-keys", () => {
  let packsDir = "";

  beforeAll(() => {
    packsDir = mkdtempSync(join(tmpdir(), "mf0012-packs-"));
    // The real packs too, so a run that does write leaves the registry as it was (no unregistering).
    cpSync(join(ROOT, "packs"), packsDir, { recursive: true });
    const broken = join(packsDir, BROKEN);
    mkdirSync(join(broken, "questions"), { recursive: true });
    const sample = readFileSync(
      join(ROOT, "packs", "team-onboarding-sample", "pack.yaml"),
      "utf8",
    );
    writeFileSync(
      join(broken, "pack.yaml"),
      sample.replace(/^slug: .*$/m, `slug: ${BROKEN}`),
    );
    writeFileSync(join(broken, "questions", "w1.yaml"), BROKEN_QUESTIONS);
  });

  afterAll(async () => {
    await removeFixtureRows();
    rmSync(packsDir, { recursive: true, force: true });
  });

  it("SC-5: a schema-invalid question file exits non-zero and changes no row", async () => {
    const before = await snapshot();

    const env: NodeJS.ProcessEnv = {
      ...process.env,
      MINDFORGE_PACKS_DIR: packsDir,
    };
    delete env.SUPABASE_DB_URL;
    const run = spawnSync(
      process.execPath,
      [join(ROOT, "scripts", "sync-question-keys.mjs")],
      { cwd: ROOT, env, encoding: "utf8" },
    );

    const after = await snapshot();
    expect(run.status, run.stdout).not.toBe(0);
    expect(after).toBe(before);
  });
});
