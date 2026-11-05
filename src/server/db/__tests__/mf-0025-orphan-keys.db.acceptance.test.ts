/**
 * MF-0025 acceptance (frozen): a sync removes the keys and items of a pack whose folder is gone, in
 * the registry transaction. Runs against the LOCAL stack (`pnpm test:db`). The sync runs over a temp
 * copy of the real packs plus one fixture pack (MF-0012 / MF-0016 precedent); the fixture folder is
 * then removed and the sync re-run. `it` blocks share state in order.
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
import {
  createTestUser,
  deleteTestUser,
  sql,
  type TestUser,
} from "@/test/local-stack";

const ROOT = resolve(import.meta.dirname, "../../../..");
const GONE = "mf0025-gone";
const QID = `${GONE}.W.1.q1`;
const RUN = `${Date.now()}-${Math.floor(Math.random() * 1e6)}`;

const QUESTIONS = `skill: W.1
questions:
  - id: ${QID}
    origin: official
    stem: Which option is right?
    select: 1
    options:
      - { id: A, text: This one, correct: true, rationale: It is. }
      - { id: B, text: That one, correct: false, rationale: It is not. }
    source: { title: Doc, url: "https://example.com/doc" }
`;

let packsDir = "";
let learner: TestUser;
let db: ReturnType<typeof sql>;

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

/** Rows of every pack except GONE, without updated_at (every upsert bumps it). */
async function otherPacks(): Promise<string> {
  const [packs, keys, items, reviews] = await Promise.all([
    db`select slug, exam_questions, exam_minutes from private.packs
       where slug <> ${GONE} order by slug`,
    db`select question_id, pack_slug, skill_code, correct_options from private.question_keys
       where pack_slug <> ${GONE} order by question_id`,
    db`select item_id, pack_slug, skill_code, item_type, content_hash, origin, author_email,
              hash_synced_at
       from private.items where pack_slug <> ${GONE} order by item_id`,
    db`select r.id, r.item_id, r.content_hash, r.verdict from private.item_reviews r
       join private.items i on i.item_id = r.item_id
       where i.pack_slug <> ${GONE} order by r.id`,
  ]);
  return JSON.stringify({ packs, keys, items, reviews });
}

async function goneCounts(): Promise<Record<string, number>> {
  const [row] = await db<
    { packs: number; keys: number; items: number; reviews: number }[]
  >`
    select
      (select count(*)::int from private.packs where slug = ${GONE}) as packs,
      (select count(*)::int from private.question_keys where pack_slug = ${GONE}) as keys,
      (select count(*)::int from private.items where pack_slug = ${GONE}) as items,
      (select count(*)::int from private.item_reviews where item_id = ${QID}) as reviews`;
  return { ...row };
}

beforeAll(async () => {
  db = sql();
  packsDir = mkdtempSync(join(tmpdir(), "mf0025-packs-"));
  cpSync(join(ROOT, "packs"), packsDir, { recursive: true });
  const dir = join(packsDir, GONE);
  mkdirSync(join(dir, "questions"), { recursive: true });
  const sample = readFileSync(
    join(ROOT, "packs", "team-onboarding-sample", "pack.yaml"),
    "utf8",
  );
  writeFileSync(
    join(dir, "pack.yaml"),
    sample.replace(/^slug: .*$/m, `slug: ${GONE}`),
  );
  writeFileSync(join(dir, "questions", "w1.yaml"), QUESTIONS);
  learner = await createTestUser(`mf0025-${RUN}@test.local`);

  // Registered state: synced, answered once, reviewed once.
  sync();
  const answered = await learner.client.rpc("record_attempt", {
    p_question_id: QID,
    p_chosen: ["A"],
  });
  if (answered.error) throw answered.error;
  await db`
    insert into private.item_reviews (item_id, content_hash, reviewer_id, verdict)
    select item_id, content_hash, ${learner.id}, 'approve'
    from private.items where item_id = ${QID}`;
  const before = await goneCounts();
  if (before.keys !== 1 || before.items !== 1 || before.reviews !== 1)
    throw new Error(`fixture not registered: ${JSON.stringify(before)}`);
});

afterAll(async () => {
  if (learner) await deleteTestUser(learner.id); // attempts + reviews cascade with the user
  await db`delete from private.items where pack_slug = ${GONE}`;
  await db`delete from private.question_keys where pack_slug = ${GONE}`;
  await db`delete from private.packs where slug = ${GONE}`;
  await db.end();
  rmSync(packsDir, { recursive: true, force: true });
});

describe("MF-0025 orphaned keys of a removed pack", () => {
  let othersBefore = "";

  it("SC-1: after its folder is removed, the pack has no registry, key or item row", async () => {
    othersBefore = await otherPacks();
    rmSync(join(packsDir, GONE), { recursive: true, force: true });
    sync();

    const { packs, keys, items } = await goneCounts();
    expect({ packs, keys, items }).toEqual({ packs: 0, keys: 0, items: 0 });
  });

  it("SC-2: its question no longer grades (P0002); the earlier attempt is kept", async () => {
    const after = await learner.client.rpc("record_attempt", {
      p_question_id: QID,
      p_chosen: ["A"],
    });
    expect(after.error?.code).toBe("P0002");

    const attempts = await learner.client
      .from("attempts")
      .select("question_id, pack_slug, chosen, correct")
      .eq("question_id", QID);
    expect(attempts.data).toEqual([
      { question_id: QID, pack_slug: GONE, chosen: ["A"], correct: true },
    ]);
  });

  it("SC-3: every other pack's rows are unchanged (regression lock)", async () => {
    expect(await otherPacks()).toBe(othersBefore);
  });

  it("SC-5: the review on the removed item is gone, and a re-run changes nothing", async () => {
    expect((await goneCounts()).reviews).toBe(0);

    const othersOnce = await otherPacks();
    sync();
    expect(await goneCounts()).toEqual({
      packs: 0,
      keys: 0,
      items: 0,
      reviews: 0,
    });
    expect(await otherPacks()).toBe(othersOnce);
  });
});
