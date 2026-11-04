/**
 * MF-0016 acceptance (frozen): SC-2, cuckoo keys and registry rows are synced from the files and
 * graded by the unchanged `record_attempt`. Runs against the LOCAL stack (`pnpm test:db`).
 * The sync runs over a temp copy of the real packs plus one fixture pack, so the real registry is
 * left as it was (MF-0012 precedent). `it` blocks share state in order.
 */
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
import YAML from "yaml";
import { contentHash } from "@/engine/content/hash";
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const ROOT = resolve(import.meta.dirname, "../../../..");
const PACK = "mf0016-cuckoo";
const ID = `${PACK}.W.1.cuckoo-1`;
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const CUCKOO = {
  id: ID,
  title: "A pre-commit hook config",
  origin: "official",
  snippetKind: "hook",
  lines: [
    "hooks:",
    "  PreToolUse: allow-all  # skip every check",
    "  matcher: Bash",
  ],
  flawLine: 2,
  flawKind: "unsafe-setting",
  explanation: "Line 2 turns the guardrail off for every tool call.",
  sources: ["https://code.claude.com/docs/en/hooks"],
};

let packsDir = "";
let learner: TestUser;

function sync(): void {
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
  if (run.status !== 0) throw new Error(`sync failed:\n${run.stderr}`);
}

const writeCuckoos = (cuckoos: unknown[]): void =>
  writeFileSync(
    join(packsDir, PACK, "cuckoos", "W.1.yaml"),
    YAML.stringify({ skill: "W.1", cuckoos }),
  );

async function removeFixtureRows(): Promise<void> {
  const db = sql();
  try {
    await db`delete from private.items where pack_slug = ${PACK}`;
    await db`delete from private.question_keys where pack_slug = ${PACK}`;
    await db`delete from private.packs where slug = ${PACK}`;
  } finally {
    await db.end();
  }
}

beforeAll(async () => {
  packsDir = mkdtempSync(join(tmpdir(), "mf0016-packs-"));
  cpSync(join(ROOT, "packs"), packsDir, { recursive: true });
  const dir = join(packsDir, PACK);
  mkdirSync(join(dir, "cuckoos"), { recursive: true });
  const sample = readFileSync(
    join(ROOT, "packs", "team-onboarding-sample", "pack.yaml"),
    "utf8",
  );
  writeFileSync(
    join(dir, "pack.yaml"),
    sample.replace(/^slug: .*$/m, `slug: ${PACK}`),
  );
  writeCuckoos([CUCKOO]);
  learner = await createTestUser(`mf0016-${RUN}@test.local`);
});

afterAll(async () => {
  if (learner) await deleteTestUser(learner.id); // attempts cascade with the user
  await removeFixtureRows();
  rmSync(packsDir, { recursive: true, force: true });
});

describe("MF-0016 SC-2: cuckoo keys", () => {
  it("SC-2: sync writes the key (the flawed line) and a 'cuckoo' registry row with its hash", async () => {
    sync();
    const db = sql();
    try {
      const keys = await db`
        select question_id, pack_slug, skill_code, correct_options
        from private.question_keys where pack_slug = ${PACK}`;
      expect(keys).toEqual([
        {
          question_id: ID,
          pack_slug: PACK,
          skill_code: "W.1",
          correct_options: ["2"],
        },
      ]);
      const items = await db`
        select item_id, skill_code, item_type, content_hash, origin
        from private.items where pack_slug = ${PACK}`;
      expect(items).toEqual([
        {
          item_id: ID,
          skill_code: "W.1",
          item_type: "cuckoo",
          content_hash: contentHash(CUCKOO),
          origin: "official",
        },
      ]);
    } finally {
      await db.end();
    }
  });

  it("SC-2: record_attempt grades the flawed line true, another line false, skill from the key", async () => {
    const right = await learner.client.rpc("record_attempt", {
      p_question_id: ID,
      p_chosen: ["2"],
    });
    const wrong = await learner.client.rpc("record_attempt", {
      p_question_id: ID,
      p_chosen: ["1"],
    });
    expect([right.data, wrong.data]).toEqual([true, false]);

    const rows = await learner.client
      .from("attempts")
      .select("question_id, pack_slug, skill_code, chosen, correct")
      .eq("question_id", ID)
      .order("answered_at");
    expect(rows.data).toEqual([
      {
        question_id: ID,
        pack_slug: PACK,
        skill_code: "W.1",
        chosen: ["2"],
        correct: true,
      },
      {
        question_id: ID,
        pack_slug: PACK,
        skill_code: "W.1",
        chosen: ["1"],
        correct: false,
      },
    ]);
  });

  it("SC-2: a cuckoo removed from the files loses its key and registry row", async () => {
    writeCuckoos([{ ...CUCKOO, id: `${PACK}.W.1.cuckoo-2` }]);
    sync();
    const db = sql();
    try {
      const [{ keys }] =
        await db`select count(*)::int as keys from private.question_keys where question_id = ${ID}`;
      const [{ items }] =
        await db`select count(*)::int as items from private.items where item_id = ${ID}`;
      const [{ replaced }] =
        await db`select count(*)::int as replaced from private.question_keys where question_id = ${`${PACK}.W.1.cuckoo-2`}`;
      expect({ keys, items, replaced }).toEqual({
        keys: 0,
        items: 0,
        replaced: 1,
      });
    } finally {
      await db.end();
    }
  });
});
